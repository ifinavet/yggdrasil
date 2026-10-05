import { expect, it } from "vitest";
import { insertUser, setup } from "../../test/fixtures";
import { internal } from "../_generated/api";

it("compensates for a late publish after board cancellation and notifies if its invite was delivered", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const applicant = await insertUser(t, "applicant@uio.no");
	const now = Date.now();
	const { periodId, applicationId, interviewId } = await t.run(async (ctx) => {
		const periodId = await ctx.db.insert("admissionPeriods", {
			title: "Høst 2026",
			applicationStartAt: now - 1_000,
			applicationEndAt: now + 86_400_000,
			interviewStartAt: now + 172_800_000,
			interviewEndAt: now + 604_800_000,
			retentionAt: now + 1_209_600_000,
			status: "open",
			revision: 1,
			interviewers: [],
			duration: 15,
			buffer: 5,
			breakEvery: 3,
			breakMinutes: 15,
			lunch: true,
			room: "Beta",
			dayStart: 540,
			dayEnd: 960,
			breaks: [],
			timezone: "Europe/Oslo",
			round: 1,
			roundHistory: [],
			createdBy: admin._id,
			updatedBy: admin._id,
		});
		const applicationId = await ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicant._id,
			availability: [],
			status: "submitted",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		});
		const interviewId = await ctx.db.insert("admissionInterviews", {
			periodId,
			applicationId,
			startAt: now + 172_800_000,
			endAt: now + 173_700_000,
			interviewerIds: [],
			selectedCalendarIds: [],
			room: "Beta",
			status: "cancelled",
			revision: 2,
		});
		await ctx.db.insert("admissionDeliveries", {
			periodId,
			applicationId,
			kind: "interview_invite",
			idempotencyKey: `admission:interview:${interviewId}:1:invite`,
			emailId: "resend-invite",
			status: "sent",
		});
		return { periodId, applicationId, interviewId };
	});

	await t.mutation(internal.admissions.compensation.queueStalePublishCleanup, {
		periodId,
		interviewId,
		publishedRevision: 1,
	});
	await t.mutation(internal.admissions.compensation.queueStalePublishCleanup, {
		periodId,
		interviewId,
		publishedRevision: 1,
	});
	const jobs = await t.run((ctx) => ctx.db.query("admissionOutbox").collect());
	expect(jobs).toHaveLength(1);
	expect(jobs[0]).toMatchObject({
		kind: "cancel_interview",
		periodId,
		applicationId,
		interviewId,
		revision: 2,
		notifyApplicant: true,
		state: "pending",
	});
});

it("does not notify after open-period cancellation when no invite was delivered", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const applicant = await insertUser(t, "applicant@uio.no");
	const now = Date.now();
	const { periodId, interviewId } = await t.run(async (ctx) => {
		const periodId = await ctx.db.insert("admissionPeriods", {
			title: "Høst 2026",
			applicationStartAt: now - 1_000,
			applicationEndAt: now + 86_400_000,
			interviewStartAt: now + 172_800_000,
			interviewEndAt: now + 604_800_000,
			retentionAt: now + 1_209_600_000,
			status: "open",
			revision: 1,
			interviewers: [],
			duration: 15,
			buffer: 5,
			breakEvery: 3,
			breakMinutes: 15,
			lunch: true,
			room: "Beta",
			dayStart: 540,
			dayEnd: 960,
			breaks: [],
			timezone: "Europe/Oslo",
			round: 1,
			roundHistory: [],
			createdBy: admin._id,
			updatedBy: admin._id,
		});
		const applicationId = await ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicant._id,
			availability: [],
			status: "submitted",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		});
		const interviewId = await ctx.db.insert("admissionInterviews", {
			periodId,
			applicationId,
			startAt: now + 172_800_000,
			endAt: now + 173_700_000,
			interviewerIds: [],
			selectedCalendarIds: [],
			room: "Beta",
			status: "cancelled",
			revision: 2,
		});
		return { periodId, interviewId };
	});

	await t.mutation(internal.admissions.compensation.queueStalePublishCleanup, {
		periodId,
		interviewId,
		publishedRevision: 1,
	});
	const jobs = await t.run((ctx) => ctx.db.query("admissionOutbox").collect());
	expect(jobs).toHaveLength(1);
	expect(jobs[0]?.notifyApplicant).toBe(false);
});
