import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertInternal,
	insertOrganizer,
	insertRegistration,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const at = (iso: string) => Date.parse(iso);
const now = at("2026-10-01T10:00:00Z");

async function leaderboardTester() {
	const { t, companyId } = await setup();
	const viewer = await insertUser(t, "viewer@example.com");
	await grantRole(t, viewer._id, "internal");

	const eventAt = (iso: string) =>
		insertEvent(t, companyId, { eventStart: at(iso), registrationOpens: at(iso) - 1 });
	const internal = async (email: string, firstName: string) => {
		const user = await insertUser(t, email, { firstName, lastName: "Intern" });
		await insertInternal(t, user._id, "Medlem");
		return user._id;
	};
	const attend = async (
		eventId: Id<"events">,
		userId: Id<"users">,
		attendanceStatus?: "confirmed" | "late" | "no_show",
	) => {
		const registrationId = await insertRegistration(t, eventId, userId, "registered");
		await t.run((ctx) => ctx.db.patch(registrationId, { attendanceStatus }));
	};

	return { t, viewer: asUser(t, viewer), eventAt, internal, attend };
}

describe("internals leaderboard", () => {
	it("ranks attendance and organizing within a semester and over a lifetime", async () => {
		const { t, viewer, eventAt, internal, attend } = await leaderboardTester();
		const ada = await internal("ada@example.com", "Ada");
		const bo = await internal("bo@example.com", "Bo");
		const student = await insertUser(t, "student@example.com");

		const spring = await eventAt("2026-03-10T16:00:00Z");
		const autumn = await eventAt("2026-09-10T16:00:00Z");
		const autumnLater = await eventAt("2026-09-20T16:00:00Z");
		const upcoming = await eventAt("2026-11-10T16:00:00Z");

		await attend(spring, ada, "confirmed");
		await attend(autumn, ada, "late");
		await attend(autumnLater, ada, "no_show");
		await attend(autumn, bo, "confirmed");
		await attend(autumnLater, bo, "confirmed");
		await attend(autumnLater, bo);
		await attend(autumn, student._id, "confirmed");

		await insertOrganizer(t, spring, bo);
		await insertOrganizer(t, autumn, ada);
		await insertOrganizer(t, autumn, bo, "medhjelper");
		await insertOrganizer(t, autumnLater, ada, "medhjelper");
		await insertOrganizer(t, upcoming, ada);

		const semester = await viewer.query(api.leaderboard.queries.internals, {
			now,
			semester: { semester: "høst", year: 2026 },
		});
		expect(semester.attended.map(({ name, rank, count }) => [name, rank, count])).toEqual([
			["Bo Intern", 1, 2],
			["Ada Intern", 2, 1],
		]);
		expect(semester.organized.map(({ name, rank, count }) => [name, rank, count])).toEqual([
			["Ada Intern", 1, 2],
			["Bo Intern", 2, 1],
		]);

		const lifetime = await viewer.query(api.leaderboard.queries.internals, { now });
		expect(lifetime.attended.map(({ name, rank, count }) => [name, rank, count])).toEqual([
			["Ada Intern", 1, 2],
			["Bo Intern", 1, 2],
		]);
		expect(lifetime.organized.map(({ name, rank, count }) => [name, rank, count])).toEqual([
			["Ada Intern", 1, 2],
			["Bo Intern", 1, 2],
		]);
	});

	it("includes admins and super-admins outside the organization once", async () => {
		const { t, eventAt, internal, attend } = await leaderboardTester();
		const viewerUser = await insertUser(t, "boss@example.com", { firstName: "Boss" });
		await grantRole(t, viewerUser._id, "super-admin");
		const admin = await insertUser(t, "admin@example.com", { firstName: "Admin" });
		await grantRole(t, admin._id, "admin");
		const editor = await insertUser(t, "editor@example.com", { firstName: "Editor" });
		await grantRole(t, editor._id, "editor");
		const both = await internal("both@example.com", "Both");
		await grantRole(t, both, "admin");

		const eventId = await eventAt("2026-09-10T16:00:00Z");
		for (const userId of [viewerUser._id, admin._id, editor._id, both]) {
			await attend(eventId, userId, "confirmed");
		}

		const { attended } = await asUser(t, viewerUser).query(api.leaderboard.queries.internals, {
			now,
		});
		expect(attended.map(({ name }) => name).sort()).toEqual([
			"Admin Testesen",
			"Boss Testesen",
			"Both Intern",
		]);
	});

	it("leaves out deleted users and internals without activity", async () => {
		const { t, viewer, eventAt, internal, attend } = await leaderboardTester();
		const gone = await internal("gone@example.com", "Gone");
		await internal("idle@example.com", "Idle");
		await t.run((ctx) => ctx.db.patch(gone, { deleted: true }));
		await attend(await eventAt("2026-09-10T16:00:00Z"), gone, "confirmed");

		expect(await viewer.query(api.leaderboard.queries.internals, { now })).toEqual({
			attended: [],
			organized: [],
		});
	});

	it("refuses users without internal rights", async () => {
		const { t } = await leaderboardTester();
		const outsider = await insertUser(t, "outsider@example.com");

		expect(
			await refusalMessageFrom(
				asUser(t, outsider).query(api.leaderboard.queries.internals, { now }),
			),
		).toBeTruthy();
	});
});
