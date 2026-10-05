import { expect, it } from "vitest";
import { applicationFields, interviewFields, periodFields } from "../../test/admissions-fixtures";
import { allOperations, stageOperation } from "../../test/admissions-workflow";
import { asUser, grantRole, insertStudent, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

async function boardFixture() {
	const { t } = await setup();
	const admin = await insertUser(t, "qa-admin@ifinavet.no");
	await grantRole(t, admin._id, "admin");
	const applicant = await insertUser(t, "qa-applicant@uio.no");
	await insertStudent(t, applicant._id);
	const now = Date.now();
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", periodFields(admin._id, { revision: 0 })),
	);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", applicationFields(periodId, applicant._id)),
	);
	return {
		t,
		admin: asUser(t, admin),
		applicant: asUser(t, applicant),
		periodId,
		applicationId,
		now,
	};
}

it("republishes an already-published interview after a room change", async () => {
	const { t, admin, applicant, periodId, applicationId, now } = await boardFixture();
	const interviewId = await t.run(async (ctx) => {
		await ctx.db.patch(periodId, { status: "published" });
		return await ctx.db.insert(
			"admissionInterviews",
			interviewFields(periodId, applicationId, {
				startAt: now + 5 * 86400000,
				endAt: now + 5 * 86400000 + 900000,
				room: "Old room",
				revision: 3,
				publishedAt: now,
				calendarEventId: "stable-event",
			}),
		);
	});

	await admin.mutation(api.admissions.board.assignRooms, {
		periodId,
		expectedRevision: 0,
		applicationIds: [applicationId],
		room: "New room",
	});

	const updated = await t.run((ctx) => ctx.db.get(interviewId));
	expect(updated).toMatchObject({
		room: "New room",
		revision: 4,
		calendarEventId: "stable-event",
	});
	expect(updated?.publishedAt).toBeUndefined();
	expect(await t.run((ctx) => ctx.db.get(periodId))).toMatchObject({ status: "published" });
	expect(await t.run((ctx) => allOperations(ctx))).toContainEqual(
		expect.objectContaining({
			kind: "publish",
			interviewId,
			revision: 4,
			idempotencyKey: `publish:${interviewId}:4`,
			state: "inProgress",
		}),
	);
	const ownApplication = await applicant.query(api.admissions.queries.myApplication, { periodId });
	expect(ownApplication?.interview).toBeNull();
});

it("reopens the published schedule when settings had reopened its period before a room edit", async () => {
	const { t, admin, periodId, applicationId, now } = await boardFixture();
	const interviewId = await t.run(
		async (ctx) =>
			await ctx.db.insert(
				"admissionInterviews",
				interviewFields(periodId, applicationId, {
					startAt: now + 5 * 86400000,
					endAt: now + 5 * 86400000 + 900000,
					room: "Old room",
					revision: 3,
					publishedAt: now,
				}),
			),
	);
	await admin.mutation(api.admissions.board.assignRooms, {
		periodId,
		expectedRevision: 0,
		applicationIds: [applicationId],
		room: "New room",
	});
	expect(await t.run((ctx) => ctx.db.get(periodId))).toMatchObject({ status: "published" });
	expect(await t.run((ctx) => ctx.db.get(interviewId))).toMatchObject({
		revision: 4,
		room: "New room",
	});
	expect(await t.run((ctx) => allOperations(ctx))).toContainEqual(
		expect.objectContaining({ kind: "publish", interviewId, revision: 4 }),
	);
});

it("prevents manual rescheduling while the first publish is in flight", async () => {
	const { t, admin, periodId, applicationId, now } = await boardFixture();
	const firstInterviewer = await insertUser(t, "qa-interviewer-one@ifinavet.no");
	const secondInterviewer = await insertUser(t, "qa-interviewer-two@ifinavet.no");
	await grantRole(t, firstInterviewer._id, "internal");
	await grantRole(t, secondInterviewer._id, "internal");
	const interviewId = await t.run(async (ctx) => {
		await ctx.db.patch(periodId, {
			status: "published",
			interviewers: [
				{ userId: firstInterviewer._id, selectedCalendarIds: ["primary"] },
				{ userId: secondInterviewer._id, selectedCalendarIds: ["primary"] },
			],
		});
		const id = await ctx.db.insert(
			"admissionInterviews",
			interviewFields(periodId, applicationId, {
				startAt: now + 5 * 86400000,
				endAt: now + 5 * 86400000 + 900000,
				interviewerIds: [firstInterviewer._id, secondInterviewer._id],
				selectedCalendarIds: ["primary"],
			}),
		);
		await stageOperation(ctx, {
			kind: "publish",
			periodId,
			applicationId,
			interviewId: id,
			revision: 1,
			idempotencyKey: `publish:${id}:1`,
			state: "inProgress",
			dueAt: now + 60000,
		});
		return id;
	});
	const application = await t.run((ctx) => ctx.db.get(applicationId));
	if (!application) throw new Error("Missing application");
	const validWorkdayAt = new Date(now + 6 * 86400000);
	validWorkdayAt.setUTCHours(8, 0, 0, 0);
	await expect(
		admin.mutation(api.admissions.mutations.scheduleInterview, {
			applicationId,
			startAt: validWorkdayAt.getTime(),
			interviewerIds: [firstInterviewer._id, secondInterviewer._id],
			selectedCalendarIds: ["primary"],
			candidateConfirmedOutsideForm: true,
			expectedRevision: application.revision,
		}),
	).rejects.toThrow(/publiseres nå/i);
	expect(await t.run((ctx) => ctx.db.get(interviewId))).toMatchObject({ revision: 1 });
});

it("rechecks the application cap when submitting an existing draft", async () => {
	const { t, applicant, periodId, applicationId } = await boardFixture();
	const users = await Promise.all(
		Array.from({ length: 200 }, (_, index) => insertUser(t, `candidate-${index}@uio.no`)),
	);
	await t.run(async (ctx) => {
		for (const user of users)
			await ctx.db.insert("admissionApplications", applicationFields(periodId, user._id));
		await ctx.db.patch(applicationId, {
			status: "draft",
			about: "About me",
			motivation: "My motivation",
			group: "unsure",
			studentProfile: {
				name: "Candidate",
				studyProgram: "Informatics",
				year: 2,
				degree: "Bachelor",
			},
		});
	});
	const draft = await t.run((ctx) => ctx.db.get(applicationId));
	if (!draft) throw new Error("Missing draft");
	await expect(
		applicant.mutation(api.admissions.mutations.submit, {
			periodId,
			expectedRevision: draft.revision,
			consent: true,
		}),
	).rejects.toThrow(/full|maksimum|limit/i);
	const saved = await t.run((ctx) => ctx.db.get(applicationId));
	expect(saved?.status).toBe("draft");
});

it("does not allow changing a decision while its delivery is queued", async () => {
	const { t, admin, periodId, applicationId, now } = await boardFixture();
	await t.run(async (ctx) => {
		await ctx.db.patch(applicationId, {
			decision: "rejected",
			decisionRevision: 2,
			decisionQueuedAt: now,
		});
		await stageOperation(ctx, {
			kind: "send_decision",
			periodId,
			applicationId,
			revision: 2,
			idempotencyKey: "decision-race",
			state: "inProgress",
			dueAt: now + 60000,
		});
	});
	const app = await t.run((ctx) => ctx.db.get(applicationId));
	if (!app) throw new Error("Missing application");
	await expect(
		admin.mutation(api.admissions.mutations.setDecision, {
			applicationId,
			decision: "shortlist",
			expectedRevision: app.revision,
		}),
	).rejects.toThrow(/vurderes nå|sendes|behandles|vent/i);
	const saved = await t.run((ctx) => ctx.db.get(applicationId));
	expect(saved?.decision).toBe("rejected");
});
