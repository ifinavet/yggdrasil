import { getStatus } from "@convex-dev/workflow";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { periodFields } from "../../test/admissions-fixtures";
import { allOperations } from "../../test/admissions-workflow";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api, components } from "../_generated/api";
import { purgeBatch } from "./lifecycle";
import { readOperation, startDelivery } from "./workflow";

const { archive, channel } = vi.hoisted(() => ({ archive: vi.fn(), channel: vi.fn() }));
vi.mock("./delivery/slack", () => ({
	admissionsSlack: () => ({}),
	archiveAdmissionsChannel: archive,
	ensureAdmissionsChannel: channel,
	postAdmissionsNotice: vi.fn(),
}));
beforeEach(() => {
	vi.useFakeTimers();
	archive.mockReset();
	channel.mockReset();
});
afterEach(() => {
	vi.useRealTimers();
});

it("retries provider failures through Workflow then removes completed workflow storage", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", periodFields(admin._id, { status: "closing" })),
	);
	archive.mockRejectedValueOnce(new Error("Temporary Slack outage")).mockResolvedValue(undefined);
	const jobId = await t.run((ctx) =>
		startDelivery(ctx, {
			periodId,
			kind: "archive_channel",
			revision: 1,
			idempotencyKey: "workflow-retry",
			dueAt: Date.now(),
		}),
	);
	const job = await t.run((ctx) => ctx.db.get(jobId));
	if (!job?.workflowId) throw new Error("Missing workflow");
	const workflowId = job.workflowId;
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(archive).toHaveBeenCalledTimes(2);
	await expect(t.run((ctx) => getStatus(ctx, components.workflow, workflowId))).rejects.toThrow();
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => allOperations(ctx))).toEqual([]);
});

it("exhausts provider retries and alerts before deleting closing data", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", periodFields(admin._id, { status: "closing" })),
	);
	archive.mockRejectedValue(new Error("Slack unavailable"));
	await t.run((ctx) =>
		startDelivery(ctx, {
			periodId,
			kind: "archive_channel",
			revision: 1,
			idempotencyKey: "workflow-exhausted",
			dueAt: Date.now(),
		}),
	);
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(archive).toHaveBeenCalledTimes(8);
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	const alerts = await t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect());
	expect(alerts).toHaveLength(1);
	expect(alerts[0]?.text).toContain("Admissions integration retry limit reached");
});

it("cancels future deliveries and removes their workflow storage when purging a period", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", periodFields(admin._id, { status: "closing" })),
	);
	const jobId = await t.run((ctx) =>
		startDelivery(ctx, {
			periodId,
			kind: "archive_channel",
			revision: 1,
			idempotencyKey: "future-cancelled",
			dueAt: Date.now() + 86400000,
		}),
	);
	const job = await t.run((ctx) => ctx.db.get(jobId));
	if (!job?.workflowId) throw new Error("Missing workflow");
	const workflowId = job.workflowId;
	await t.run((ctx) => purgeBatch(ctx, periodId));
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(archive).not.toHaveBeenCalled();
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	await expect(t.run((ctx) => getStatus(ctx, components.workflow, workflowId))).rejects.toThrow();
});

it("restarts a failed native workflow once and retains successful idempotency", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const periodId = await t.run((ctx) => ctx.db.insert("admissionPeriods", periodFields(admin._id)));
	const operation = {
		kind: "sync_channel" as const,
		periodId,
		revision: 1,
		idempotencyKey: "native-restart",
		dueAt: Date.now(),
	};
	channel.mockRejectedValue(new Error("Slack temporarily unavailable"));
	const refId = await t.run((ctx) => startDelivery(ctx, operation));
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	const ref = await t.run((ctx) => ctx.db.get(refId));
	if (!ref) throw new Error("Missing workflow reference");
	expect(await t.run((ctx) => readOperation(ctx, ref))).toMatchObject({ state: "failed" });
	expect(channel).toHaveBeenCalledTimes(8);
	channel.mockResolvedValue("C-admissions");
	const authenticated = asUser(t, admin);
	expect(
		await authenticated.mutation(api.admissions.workflow.retry, {
			idempotencyKey: operation.idempotencyKey,
		}),
	).toEqual({ queued: true });
	expect(
		await authenticated.mutation(api.admissions.workflow.retry, {
			idempotencyKey: operation.idempotencyKey,
		}),
	).toEqual({ queued: false });
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(channel).toHaveBeenCalledTimes(9);
	expect(await t.run((ctx) => readOperation(ctx, ref))).toMatchObject({
		state: "success",
		workflowId: ref.workflowId,
	});
	expect(await t.run((ctx) => startDelivery(ctx, operation))).toBe(refId);
	expect(
		await authenticated.mutation(api.admissions.workflow.retry, {
			idempotencyKey: operation.idempotencyKey,
		}),
	).toEqual({ queued: false });
	expect(await t.run((ctx) => allOperations(ctx))).toHaveLength(1);
});
