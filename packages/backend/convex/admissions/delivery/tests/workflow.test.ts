import { getStatus } from "@convex-dev/workflow";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { admissionPeriodFixture } from "../../../../test/admissions-fixtures";
import { allOperations } from "../../../../test/admissions-workflow";
import { asUser } from "../../../../test/fixtures";
import { api, components } from "../../../_generated/api";
import { purgeBatch } from "../../lifecycle";
import { readOperation, startDelivery } from "../workflow";

const { archive, channel } = vi.hoisted(() => ({ archive: vi.fn(), channel: vi.fn() }));
vi.mock("../slack", () => ({
	admissionsSlack: () => ({}),
	archiveAdmissionsChannel: archive,
	ensureAdmissionsChannel: channel,
}));
beforeEach(() => {
	vi.useFakeTimers();
	archive.mockReset();
	channel.mockReset();
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

it.each(["local", "production"])(
	"retries provider failures through Workflow in %s and removes completed workflow storage",
	async (environment) => {
		vi.stubEnv("APP_ENV", environment);
		vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
		const { t, periodId } = await admissionPeriodFixture({ status: "closing" });
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
	},
);

it("exhausts provider retries and alerts before deleting closing data", async () => {
	const { t, periodId } = await admissionPeriodFixture({ status: "closing" });
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
	const { t, periodId } = await admissionPeriodFixture({ status: "closing" });
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
	const { t, admin, periodId } = await admissionPeriodFixture();
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
		await authenticated.mutation(api.admissions.delivery.workflow.retry, {
			idempotencyKey: operation.idempotencyKey,
		}),
	).toEqual({ queued: true });
	expect(
		await authenticated.mutation(api.admissions.delivery.workflow.retry, {
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
		await authenticated.mutation(api.admissions.delivery.workflow.retry, {
			idempotencyKey: operation.idempotencyKey,
		}),
	).toEqual({ queued: false });
	expect(await t.run((ctx) => allOperations(ctx))).toHaveLength(1);
});
