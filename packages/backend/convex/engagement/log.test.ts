import { describe, expect, it } from "vitest";
import { insertEvent, insertUser, setup, type TestBackend } from "../../test/fixtures";
import type { Id } from "../_generated/dataModel";
import { logRegistrationChange } from "./log";

async function logsFor(t: TestBackend, eventId: Id<"events">) {
	return t.run((ctx) =>
		ctx.db
			.query("registrationLog")
			.withIndex("by_eventId_and_at", (q) => q.eq("eventId", eventId))
			.collect(),
	);
}

describe("logRegistrationChange", () => {
	it("records the given change with the registration's current status as fromStatus", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const user = await insertUser(t, "bruker@example.com");
		const at = Date.now() + 60_000;

		await t.run((ctx) =>
			logRegistrationChange(
				ctx,
				{ eventId, userId: user._id, status: "registered" },
				"unregistered",
				at,
			),
		);

		const logs = await logsFor(t, eventId);
		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({
			eventId,
			userId: user._id,
			change: "unregistered",
			fromStatus: "registered",
			at,
		});
	});

	it("defaults fromStatus to undefined and at to now when not given", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const user = await insertUser(t, "bruker2@example.com");
		const before = Date.now();

		await t.run((ctx) => logRegistrationChange(ctx, { eventId, userId: user._id }, "registered"));

		const [entry] = await logsFor(t, eventId);
		expect(entry?.fromStatus).toBeUndefined();
		expect(entry?.at).toBeGreaterThanOrEqual(before);
		expect(entry?.change).toBe("registered");
	});
});
