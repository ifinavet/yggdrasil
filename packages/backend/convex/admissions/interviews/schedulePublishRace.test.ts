import { expect, it } from "vitest";
import {
	applicationFields,
	insertInterview,
	periodFields,
} from "../../../test/admissions-fixtures";
import { stageOperation } from "../../../test/admissions-workflow";
import { grantRole, insertUser, setup } from "../../../test/fixtures";
import { internal } from "../../_generated/api";

it("keeps a schedule immutable while its first calendar publish is in flight", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const applicant = await insertUser(t, "applicant@uio.no");
	const firstInterviewer = await insertUser(t, "first@example.test");
	const secondInterviewer = await insertUser(t, "second@example.test");
	await grantRole(t, firstInterviewer._id, "internal");
	await grantRole(t, secondInterviewer._id, "internal");
	const now = Date.now();
	const periodId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, {
				status: "published",
				interviewers: [
					{ userId: firstInterviewer._id, selectedCalendarIds: [] },
					{ userId: secondInterviewer._id, selectedCalendarIds: [] },
				],
			}),
		),
	);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", applicationFields(periodId, applicant._id)),
	);
	const startAt = now + 3 * 24 * 60 * 60 * 1000;
	const interviewId = await insertInterview(t, periodId, applicationId, {
		startAt,
		endAt: startAt + 15 * 60 * 1000,
		interviewerIds: [firstInterviewer._id, secondInterviewer._id],
		revision: 1,
	});
	await t.run((ctx) =>
		stageOperation(ctx, {
			kind: "publish",
			periodId,
			applicationId,
			interviewId,
			revision: 1,
			idempotencyKey: `publish:${interviewId}:1`,
			state: "inProgress",
			dueAt: now + 5 * 60 * 1000,
		}),
	);

	await expect(
		t.mutation(internal.admissions.internal.saveSchedule, {
			periodId,
			expectedRevision: 1,
			assignments: [
				{
					applicationId,
					startAt: startAt + 15 * 60 * 1000,
					endAt: startAt + 30 * 60 * 1000,
					interviewerIds: [firstInterviewer._id, secondInterviewer._id],
					selectedCalendarIds: [],
					room: "Beta",
				},
			],
		}),
	).rejects.toThrow(/publiseres nå/);
	const saved = await t.run((ctx) => ctx.db.get(interviewId));
	expect(saved).toMatchObject({ revision: 1, startAt });
	expect(saved?.publishedAt).toBeUndefined();
});
