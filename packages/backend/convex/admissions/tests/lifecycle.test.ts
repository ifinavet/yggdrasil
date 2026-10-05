import { expect, it } from "vitest";
import {
	applicationFields,
	firstAdmissionOperation,
	periodFields,
} from "../../../test/admissions-fixtures";
import {
	deliveryContext,
	finishOperation,
	stageOperation,
} from "../../../test/admissions-workflow";
import { asUser, grantRole, insertUser, setup } from "../../../test/fixtures";
import { api } from "../../_generated/api";

it("keeps closing data until an already-running decision and reminder settle", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const applicant = await insertUser(t, "applicant@uio.no");
	const { periodId, applicationId } = await t.run(async (ctx) => {
		const periodId = await ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, { status: "closing" }),
		);
		const applicationId = await ctx.db.insert(
			"admissionApplications",
			applicationFields(periodId, applicant._id, {
				decisionRevision: 1,
				decision: "accepted",
				offerStatus: "pending",
			}),
		);
		const jobs = [
			{
				kind: "send_decision" as const,
				applicationId,
				idempotencyKey: "decision-running",
			},
			{ kind: "remind_1d" as const, idempotencyKey: "reminder-running" },
			{
				kind: "archive_channel" as const,
				idempotencyKey: "archive-done",
				state: "success" as const,
			},
		];
		for (const job of jobs)
			await stageOperation(ctx, {
				...job,
				periodId,
				revision: 1,
				state: job.state ?? "inProgress",
				dueAt: Date.now(),
			});
		return { periodId, applicationId };
	});

	await finishOperation(t, "decision-running");
	expect(await t.run((ctx) => ctx.db.get(periodId))).not.toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();

	await finishOperation(t, "reminder-running");
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toBeNull();
});

it("sends a declined-offer notice before archiving the channel during close", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const applicant = await insertUser(t, "applicant@uio.no");
	const { periodId, applicationId } = await t.run(async (ctx) => {
		const now = Date.now();
		const periodId = await ctx.db.insert("admissionPeriods", periodFields(admin._id));
		const applicationId = await ctx.db.insert(
			"admissionApplications",
			applicationFields(periodId, applicant._id, {
				revision: 2,
				decisionRevision: 3,
				decision: "accepted",
				decisionSentAt: now - 1_000,
				offerStatus: "declined",
			}),
		);
		await stageOperation(ctx, {
			kind: "offer_declined",
			periodId,
			applicationId,
			revision: 3,
			idempotencyKey: "declined-before-close",
			state: "inProgress",
			dueAt: now,
		});
		return { periodId, applicationId };
	});

	await asUser(t, admin).mutation(api.admissions.mutations.closePeriod, {
		periodId,
		force: true,
	});
	const claimed = await deliveryContext(t, "declined-before-close");
	expect(claimed?.job.idempotencyKey).toBe("declined-before-close");
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toBeNull();

	await finishOperation(t, "declined-before-close");
	expect(await firstAdmissionOperation(t, periodId, "offer_declined")).toMatchObject({
		applicationId,
		state: "success",
	});
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toMatchObject({
		kind: "archive_channel",
		state: "inProgress",
	});
});
