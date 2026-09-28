import { describe, expect, it } from "vitest";
import { asUser, insertStudent, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";
import { POINT_LIFETIME_MS } from "./lifetime";

const queries = api.points.queries;

describe("getCurrentStudentsPoints", () => {
	it("returns the caller's points newest first with the time each one expires", async () => {
		const { t } = await setup();
		const student = await insertUser(t, "student@example.com");
		const studentId = await insertStudent(t, student._id);
		const other = await insertUser(t, "annen@example.com");
		const otherId = await insertStudent(t, other._id);
		const olderId = await t.run((ctx) =>
			ctx.db.insert("points", { studentId, reason: "Sen", severity: 1 }),
		);
		const newerId = await t.run((ctx) =>
			ctx.db.insert("points", { studentId, reason: "Ikke møtt", severity: 2 }),
		);
		await t.run((ctx) =>
			ctx.db.insert("points", { studentId: otherId, reason: "Annen", severity: 2 }),
		);
		const [older, newer] = await t.run(async (ctx) => [
			await ctx.db.get(olderId),
			await ctx.db.get(newerId),
		]);

		const points = await asUser(t, student).query(queries.getCurrentStudentsPoints, {});

		expect(points).toEqual([
			{ ...newer, expiresAt: (newer?._creationTime ?? 0) + POINT_LIFETIME_MS },
			{ ...older, expiresAt: (older?._creationTime ?? 0) + POINT_LIFETIME_MS },
		]);
	});

	it("returns null when the caller has no student profile", async () => {
		const { t } = await setup();
		const user = await insertUser(t, "ansatt@example.com");

		expect(await asUser(t, user).query(queries.getCurrentStudentsPoints, {})).toBeNull();
	});
});
