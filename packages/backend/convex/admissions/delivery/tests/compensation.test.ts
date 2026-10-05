import { expect, it } from "vitest";
import {
	applicationFields,
	interviewFields,
	periodFields,
} from "../../../../test/admissions-fixtures";
import { allOperations } from "../../../../test/admissions-workflow";
import { insertUser, setup } from "../../../../test/fixtures";
import { internal } from "../../../_generated/api";

async function cancelledInterviewFixture() {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const applicant = await insertUser(t, "applicant@uio.no");
	const now = Date.now();
	const periodId = await t.run((ctx) => ctx.db.insert("admissionPeriods", periodFields(admin._id)));
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", applicationFields(periodId, applicant._id)),
	);
	const interviewId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionInterviews",
			interviewFields(periodId, applicationId, {
				startAt: now + 172_800_000,
				endAt: now + 173_700_000,
				status: "cancelled",
				revision: 2,
			}),
		),
	);
	return { t, periodId, applicationId, interviewId };
}

it("compensates for a late publish after board cancellation and notifies if its invite was delivered", async () => {
	const { t, periodId, applicationId, interviewId } = await cancelledInterviewFixture();
	await t.run((ctx) =>
		ctx.db.insert("admissionDeliveries", {
			periodId,
			applicationId,
			kind: "interview_invite",
			idempotencyKey: `admission:interview:${interviewId}:1:invite`,
			emailId: "resend-invite",
			status: "sent",
		}),
	);

	await t.mutation(internal.admissions.delivery.compensation.queueStalePublishCleanup, {
		periodId,
		interviewId,
		publishedRevision: 1,
	});
	await t.mutation(internal.admissions.delivery.compensation.queueStalePublishCleanup, {
		periodId,
		interviewId,
		publishedRevision: 1,
	});
	const jobs = await t.run((ctx) => allOperations(ctx));
	expect(jobs).toHaveLength(1);
	expect(jobs[0]).toMatchObject({
		kind: "cancel_interview",
		periodId,
		applicationId,
		interviewId,
		revision: 2,
		notifyApplicant: true,
		state: "inProgress",
	});
});

it("does not notify after open-period cancellation when no invite was delivered", async () => {
	const { t, periodId, interviewId } = await cancelledInterviewFixture();

	await t.mutation(internal.admissions.delivery.compensation.queueStalePublishCleanup, {
		periodId,
		interviewId,
		publishedRevision: 1,
	});
	const jobs = await t.run((ctx) => allOperations(ctx));
	expect(jobs).toHaveLength(1);
	expect(jobs[0]?.notifyApplicant).toBe(false);
});
