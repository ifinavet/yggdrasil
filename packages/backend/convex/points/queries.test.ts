import { describe, expect, it } from "vitest";
import { asUser, givePointsTo, insertStudent, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

describe("getCurrentStudentsPoints", () => {
	it("returns the points of the signed-in student", async () => {
		const { t } = await setup();
		const user = await insertUser(t, "student@example.test");
		const studentId = await insertStudent(t, user._id);
		await givePointsTo(t, studentId, 2);

		const points = await asUser(t, user).query(api.points.queries.getCurrentStudentsPoints, {});

		expect(points?.map((point) => point.severity)).toEqual([2]);
	});

	it("returns null when the user has no student profile", async () => {
		const { t } = await setup();
		const user = await insertUser(t, "company@example.test");

		const points = await asUser(t, user).query(api.points.queries.getCurrentStudentsPoints, {});

		expect(points).toBeNull();
	});

	it("returns null when the signed-in identity has no user record yet", async () => {
		const { t } = await setup();

		const points = await t
			.withIdentity({ subject: "user_not_synced_from_clerk" })
			.query(api.points.queries.getCurrentStudentsPoints, {});

		expect(points).toBeNull();
	});
});
