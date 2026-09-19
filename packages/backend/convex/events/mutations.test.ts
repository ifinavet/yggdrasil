import { describe, expect, it } from "vitest";
import {
	emailsWithStatus,
	insertEvent,
	insertRegistration,
	insertUser,
	scheduledRecipientsOf,
	setup,
	statusOf,
} from "../../test/fixtures";
import { internal } from "../_generated/api";

const eventMutations = internal.events.mutations;

describe("updateWaitlistMutation", () => {
	it("offers the new places to the front of the queue in order", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });
		const firstWaiting = await insertUser(t, "venter-1@example.com");
		await insertRegistration(t, eventId, firstWaiting._id, "waitlist", now);
		const secondWaiting = await insertUser(t, "venter-2@example.com");
		await insertRegistration(t, eventId, secondWaiting._id, "waitlist", now + 1);
		const thirdWaiting = await insertUser(t, "venter-3@example.com");
		const thirdWaitingId = await insertRegistration(
			t,
			eventId,
			thirdWaiting._id,
			"waitlist",
			now + 2,
		);

		await t.mutation(eventMutations.updateWaitlistMutation, { eventId, numOfNewPlaces: 2 });

		expect(await emailsWithStatus(t, eventId, "pending")).toEqual([
			"venter-1@example.com",
			"venter-2@example.com",
		]);
		expect(await statusOf(t, thirdWaitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([
			"venter-1@example.com",
			"venter-2@example.com",
		]);
	});

	it("offers nothing when there are no new places", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });
		const waiting = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(t, eventId, waiting._id, "waitlist");

		await t.mutation(eventMutations.updateWaitlistMutation, { eventId, numOfNewPlaces: 0 });

		expect(await statusOf(t, waitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([]);
	});

	it("stops at the participation limit even when asked for more places", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const firstWaiting = await insertUser(t, "venter-1@example.com");
		await insertRegistration(t, eventId, firstWaiting._id, "waitlist", now);
		const secondWaiting = await insertUser(t, "venter-2@example.com");
		const secondWaitingId = await insertRegistration(
			t,
			eventId,
			secondWaiting._id,
			"waitlist",
			now + 1,
		);

		await t.mutation(eventMutations.updateWaitlistMutation, { eventId, numOfNewPlaces: 5 });

		expect(await emailsWithStatus(t, eventId, "pending")).toEqual(["venter-1@example.com"]);
		expect(await statusOf(t, secondWaitingId)).toBe("waitlist");
	});

	it("refuses an event that no longer exists", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		await t.run((ctx) => ctx.db.delete(eventId));

		await expect(
			t.mutation(eventMutations.updateWaitlistMutation, { eventId, numOfNewPlaces: 1 }),
		).rejects.toThrow("ble ikke funnet");
	});
});
