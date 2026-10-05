import { expect, it } from "vitest";
import {
	applicationFields,
	firstAdmissionOutboxJob,
	periodFields,
} from "../../test/admissions-fixtures";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api, internal } from "../_generated/api";

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
			{ kind: "archive_channel" as const, idempotencyKey: "archive-done", state: "done" as const },
		];
		for (const job of jobs)
			await ctx.db.insert("admissionOutbox", {
				...job,
				periodId,
				revision: 1,
				state: job.state ?? "running",
				attempts: 1,
				nextAttemptAt: Date.now() + 300_000,
				createdAt: Date.now(),
			});
		return { periodId, applicationId };
	});

	await t.mutation(internal.admissions.internal.completeOutbox, {
		idempotencyKey: "decision-running",
	});
	expect(await t.run((ctx) => ctx.db.get(periodId))).not.toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();

	await t.mutation(internal.admissions.internal.completeOutbox, {
		idempotencyKey: "reminder-running",
	});
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
				sent: true,
			}),
		);
		await ctx.db.insert("admissionOutbox", {
			kind: "offer_declined",
			periodId,
			applicationId,
			revision: 3,
			idempotencyKey: "declined-before-close",
			state: "pending",
			attempts: 0,
			nextAttemptAt: now,
			createdAt: now,
		});
		return { periodId, applicationId };
	});

	await asUser(t, admin).mutation(api.admissions.mutations.closePeriod, {
		periodId,
		idempotencyKey: "close-after-decline",
		force: true,
	});
	const claimed = await t.mutation(internal.admissions.internal.claimOutbox, {
		idempotencyKey: "declined-before-close",
	});
	expect(claimed?.job.state).toBe("running");
	expect(await firstAdmissionOutboxJob(t, periodId, "archive_channel")).toBeNull();

	await t.mutation(internal.admissions.internal.completeOutbox, {
		idempotencyKey: "declined-before-close",
	});
	expect(await firstAdmissionOutboxJob(t, periodId, "offer_declined")).toMatchObject({
		applicationId,
		state: "done",
	});
	expect(await firstAdmissionOutboxJob(t, periodId, "archive_channel")).toMatchObject({
		kind: "archive_channel",
		state: "pending",
	});
});
