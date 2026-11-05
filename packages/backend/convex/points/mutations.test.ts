import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	DAY_IN_MS,
	givePointsTo,
	insertStudent,
	insertUser,
	pointsFor,
	refusalMessageFrom,
	scheduledRecipientsOf,
	setupAdminAndEditor,
	type TestBackend,
} from "../../test/fixtures";
import { api } from "../_generated/api";

const mutations = api.points.mutations;
const manualPoint = { reason: "Manuell prikk", severity: 1 };

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

async function scenario() {
	const { t, admin, editor } = await setupAdminAndEditor();
	const user = await insertUser(t, "student@example.com");
	const studentId = await insertStudent(t, user._id);
	return { t, admin, editor, student: asUser(t, user), studentId };
}

async function finishDelayedEmails(t: TestBackend) {
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	return {
		pointEmails: await scheduledRecipientsOf(t, "sendGottenPointsEmail"),
		lockoutEmails: await scheduledRecipientsOf(t, "sendTooManyPointsEmail"),
	};
}

describe("giveManualPoints", () => {
	it("stores the points and emails the student only after the delay", async () => {
		const { t, admin, studentId } = await scenario();

		await admin.mutation(mutations.giveManualPoints, { id: studentId, ...manualPoint });

		expect(await pointsFor(t, studentId)).toMatchObject([manualPoint]);
		vi.advanceTimersByTime(DAY_IN_MS - 1);
		await t.finishInProgressScheduledFunctions();
		expect(await scheduledRecipientsOf(t, "sendGottenPointsEmail")).toEqual([]);

		expect(await finishDelayedEmails(t)).toEqual({
			pointEmails: ["student@example.com"],
			lockoutEmails: [],
		});
	});

	it("also sends the lockout email when the points reach the limit", async () => {
		const { t, admin, studentId } = await scenario();
		await givePointsTo(t, studentId, 2);

		await admin.mutation(mutations.giveManualPoints, { id: studentId, ...manualPoint });

		expect(await finishDelayedEmails(t)).toEqual({
			pointEmails: ["student@example.com"],
			lockoutEmails: ["student@example.com"],
		});
	});

	it("refuses a student that does not exist", async () => {
		const { t, admin, studentId } = await scenario();
		await t.run((ctx) => ctx.db.delete(studentId));

		const message = await refusalMessageFrom(
			admin.mutation(mutations.giveManualPoints, { id: studentId, ...manualPoint }),
		);

		expect(message).toContain("ikke funnet");
		expect(await pointsFor(t, studentId)).toEqual([]);
	});

	it("refuses a caller without an internal role", async () => {
		const { t, student, studentId } = await scenario();

		const message = await refusalMessageFrom(
			student.mutation(mutations.giveManualPoints, { id: studentId, ...manualPoint }),
		);

		expect(message).toContain("Unauthorized");
		expect(await pointsFor(t, studentId)).toEqual([]);
	});
});

describe("remove", () => {
	it("stops the pending emails when an admin removes the points within the delay", async () => {
		const { t, admin, studentId } = await scenario();
		await admin.mutation(mutations.giveManualPoints, {
			id: studentId,
			...manualPoint,
			severity: 3,
		});

		for (const { _id } of await pointsFor(t, studentId)) {
			await admin.mutation(mutations.remove, { id: _id });
		}

		expect(await pointsFor(t, studentId)).toEqual([]);
		expect(await finishDelayedEmails(t)).toEqual({ pointEmails: [], lockoutEmails: [] });
	});

	it("refuses a caller who is not an admin", async () => {
		const { t, editor, studentId } = await scenario();
		const pointId = await givePointsTo(t, studentId, 1);

		const message = await refusalMessageFrom(editor.mutation(mutations.remove, { id: pointId }));

		expect(message).toContain("Unauthorized");
		expect(await pointsFor(t, studentId)).toHaveLength(1);
	});
});
