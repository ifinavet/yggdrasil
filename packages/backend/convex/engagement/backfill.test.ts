import { describe, expect, it, vi } from "vitest";
import {
	asUser,
	DAY_IN_MS,
	grantRole,
	insertEvent,
	insertRegistration,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { initialChangeOf } from "./backfill";
import { logRegistrationChange } from "./log";

async function logsFor(t: TestBackend, eventId: Id<"events">) {
	return t.run((ctx) =>
		ctx.db
			.query("registrationLog")
			.withIndex("by_eventId_and_at", (q) => q.eq("eventId", eventId))
			.collect(),
	);
}

async function internalUser(t: TestBackend) {
	const user = await insertUser(t, "intern@example.com");
	await grantRole(t, user._id, "internal");
	return asUser(t, user);
}

describe("initialChangeOf", () => {
	it("maps registered rows to registered and everything else to waitlisted", () => {
		expect(initialChangeOf("registered")).toBe("registered");
		expect(initialChangeOf("waitlist")).toBe("waitlisted");
		expect(initialChangeOf("pending")).toBe("waitlisted");
	});
});

describe("registration log backfill", () => {
	it("logs existing registrations at their registration time", async () => {
		vi.useFakeTimers();
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		const bo = await insertUser(t, "bo@example.com");
		const registeredAt = Date.now() - 3 * DAY_IN_MS;
		const waitlistedAt = Date.now() - DAY_IN_MS;
		await insertRegistration(t, eventId, ada._id, "registered", registeredAt);
		await insertRegistration(t, eventId, bo._id, "waitlist", waitlistedAt);
		const internal = await internalUser(t);

		expect(await internal.query(api.engagement.backfill.pending, {})).toBe(true);
		await internal.mutation(api.engagement.backfill.setup, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const logs = await logsFor(t, eventId);
		expect(
			logs.map(({ userId, change, at, fromStatus }) => ({ userId, change, at, fromStatus })),
		).toEqual([
			{ userId: ada._id, change: "registered", at: registeredAt, fromStatus: undefined },
			{ userId: bo._id, change: "waitlisted", at: waitlistedAt, fromStatus: undefined },
		]);
		expect(await internal.query(api.engagement.backfill.pending, {})).toBe(false);
		vi.useRealTimers();
	});

	it("skips registrations that already have live log entries", async () => {
		vi.useFakeTimers();
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		await insertRegistration(t, eventId, ada._id, "registered");
		await t.run((ctx) => logRegistrationChange(ctx, { eventId, userId: ada._id }, "registered"));
		const internal = await internalUser(t);

		await internal.mutation(api.engagement.backfill.setup, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await logsFor(t, eventId)).toHaveLength(1);
		vi.useRealTimers();
	});

	it("runs once even when several people open the page", async () => {
		vi.useFakeTimers();
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		const bo = await insertUser(t, "bo@example.com");
		await insertRegistration(t, eventId, ada._id, "registered");
		const internal = await internalUser(t);

		await internal.mutation(api.engagement.backfill.setup, {});
		await internal.mutation(api.engagement.backfill.setup, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		await insertRegistration(t, eventId, bo._id, "registered");
		await internal.mutation(api.engagement.backfill.setup, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const logs = await logsFor(t, eventId);
		expect(logs.map(({ userId }) => userId)).toEqual([ada._id]);
		vi.useRealTimers();
	});

	it("refuses students", async () => {
		const { t } = await setup();
		const student = await insertUser(t, "student@example.com");

		expect(
			await refusalMessageFrom(asUser(t, student).mutation(api.engagement.backfill.setup, {})),
		).toBeTruthy();
		expect(
			await refusalMessageFrom(asUser(t, student).query(api.engagement.backfill.pending, {})),
		).toBeTruthy();
	});
});
