import { describe, expect, it } from "vitest";
import {
	asUser,
	DAY_IN_MS,
	grantRole,
	insertEvent,
	insertRegistration,
	insertStudent,
	insertUser,
	setup,
} from "../../test/fixtures";
import { api } from "../_generated/api";

describe("semester", () => {
	it("compares against the previous semester at the same point in time", async () => {
		const { t, companyId } = await setup();
		const now = Date.parse("2026-10-01T10:00:00Z");
		const at = (iso: string) => Date.parse(iso);
		const current = await insertEvent(t, companyId, {
			registrationOpens: at("2026-09-20T10:00:00Z"),
			eventStart: at("2026-10-05T16:00:00Z"),
		});
		const early = await insertEvent(t, companyId, {
			registrationOpens: at("2026-01-10T10:00:00Z"),
			eventStart: at("2026-01-20T16:00:00Z"),
		});
		const late = await insertEvent(t, companyId, {
			registrationOpens: at("2026-05-01T10:00:00Z"),
			eventStart: at("2026-05-10T16:00:00Z"),
		});
		for (const [email, eventId] of [
			["ada@example.com", current],
			["bo@example.com", early],
			["cy@example.com", late],
		] as const) {
			const user = await insertUser(t, email);
			await insertStudent(t, user._id);
			await insertRegistration(t, eventId, user._id, "registered", now - DAY_IN_MS);
		}
		const intern = await insertUser(t, "intern@example.com");
		await grantRole(t, intern._id, "internal");

		const { audience } = await asUser(t, intern).query(api.engagement.queries.semester, { now });

		expect(audience.cohorts.map(({ reach, previousReach }) => ({ reach, previousReach }))).toEqual([
			{ reach: 1 / 3, previousReach: 1 / 3 },
		]);
	});
});
