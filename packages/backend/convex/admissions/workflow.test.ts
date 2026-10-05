import { getStatus } from "@convex-dev/workflow";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { periodFields } from "../../test/admissions-fixtures";
import { insertUser, setup } from "../../test/fixtures";
import { components } from "../_generated/api";
import { queueOutbox } from "./lifecycle";

const archive = vi.hoisted(() => vi.fn());
vi.mock("./delivery/slack", () => ({
	admissionsSlack: () => ({}),
	archiveAdmissionsChannel: archive,
	ensureAdmissionsChannel: vi.fn(),
	postAdmissionsNotice: vi.fn(),
}));
beforeEach(() => {
	vi.useFakeTimers();
	archive.mockReset();
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
		queueOutbox(ctx, {
			periodId,
			kind: "archive_channel",
			revision: 1,
			idempotencyKey: "workflow-retry",
			nextAttemptAt: Date.now(),
		}),
	);
	const job = await t.run((ctx) => ctx.db.get(jobId));
	if (!job?.workflowId) throw new Error("Missing workflow");
	const workflowId = job.workflowId;
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(archive).toHaveBeenCalledTimes(2);
	await expect(t.run((ctx) => getStatus(ctx, components.workflow, workflowId))).rejects.toThrow();
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.query("admissionOutbox").collect())).toEqual([]);
});

it("exhausts provider retries and alerts before deleting closing data", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", periodFields(admin._id, { status: "closing" })),
	);
	archive.mockRejectedValue(new Error("Slack unavailable"));
	await t.run((ctx) =>
		queueOutbox(ctx, {
			periodId,
			kind: "archive_channel",
			revision: 1,
			idempotencyKey: "workflow-exhausted",
			nextAttemptAt: Date.now(),
		}),
	);
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	expect(archive).toHaveBeenCalledTimes(8);
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	const alerts = await t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect());
	expect(alerts).toHaveLength(1);
	expect(alerts[0]?.text).toContain("Admissions integration retry limit reached");
});
