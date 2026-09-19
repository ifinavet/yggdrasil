import { describe, expect, it } from "vitest";
import {
	countRegistrationsForEvent,
	DAY_IN_MS,
	emailsWithStatus,
	HOUR_IN_MS,
	insertEvent,
	insertRegistration,
	insertUser,
	scheduledRecipientsOf,
	setup,
	statusOf,
} from "../../../test/fixtures";
import { internal } from "../../_generated/api";

const waitlistMutations = internal.events.waitlist.mutations;

const ANSWER_TIME_LIMIT_IN_MS = 16 * HOUR_IN_MS;
const EXPIRED_OFFER_AGE_IN_MS = ANSWER_TIME_LIMIT_IN_MS + HOUR_IN_MS;

describe("checkPendingRegistrations", () => {
	it("moves an expired offer to the back and offers the seat to the next in line", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const expiredUser = await insertUser(t, "utlopt@example.com");
		const expiredId = await insertRegistration(
			t,
			eventId,
			expiredUser._id,
			"pending",
			now - EXPIRED_OFFER_AGE_IN_MS,
		);
		const waitingUser = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(
			t,
			eventId,
			waitingUser._id,
			"waitlist",
			now - 10 * HOUR_IN_MS,
		);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await statusOf(t, waitingId)).toBe("pending");
		expect(await statusOf(t, expiredId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([
			"venter@example.com",
		]);
	});

	it("re-offers the seat to the same person when nobody else is waiting", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const expiredUser = await insertUser(t, "eneste@example.com");
		const expiredId = await insertRegistration(
			t,
			eventId,
			expiredUser._id,
			"pending",
			now - EXPIRED_OFFER_AGE_IN_MS,
		);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expiredId)).toBe("pending");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([
			"eneste@example.com",
		]);
	});

	it("leaves an offer that is still inside the answer window alone", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const offeredUser = await insertUser(t, "tilbudt@example.com");
		const offeredId = await insertRegistration(
			t,
			eventId,
			offeredUser._id,
			"pending",
			now - HOUR_IN_MS,
		);
		const waitingUser = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(t, eventId, waitingUser._id, "waitlist", now);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await statusOf(t, offeredId)).toBe("pending");
		expect(await statusOf(t, waitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([]);
	});

	it("ignores an unpublished event", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { published: false });
		const expiredUser = await insertUser(t, "utlopt@example.com");
		const expiredId = await insertRegistration(
			t,
			eventId,
			expiredUser._id,
			"pending",
			now - EXPIRED_OFFER_AGE_IN_MS,
		);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expiredId)).toBe("pending");
	});

	it("ignores an event that registers through an external url", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, {
			externalEvent: true,
			externalUrl: "https://example.com/pamelding",
		});
		const expiredUser = await insertUser(t, "utlopt@example.com");
		const expiredId = await insertRegistration(
			t,
			eventId,
			expiredUser._id,
			"pending",
			now - EXPIRED_OFFER_AGE_IN_MS,
		);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expiredId)).toBe("pending");
	});

	it("ignores an event that started more than an hour ago", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { eventStart: now - 2 * HOUR_IN_MS });
		const expiredUser = await insertUser(t, "utlopt@example.com");
		const expiredId = await insertRegistration(
			t,
			eventId,
			expiredUser._id,
			"pending",
			now - EXPIRED_OFFER_AGE_IN_MS,
		);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expiredId)).toBe("pending");
	});

	it("ignores an event whose registration has not opened yet", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { registrationOpens: now + DAY_IN_MS });
		const expiredUser = await insertUser(t, "utlopt@example.com");
		const expiredId = await insertRegistration(
			t,
			eventId,
			expiredUser._id,
			"pending",
			now - EXPIRED_OFFER_AGE_IN_MS,
		);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expiredId)).toBe("pending");
	});

	it("ignores an event whose registration opened more than a month ago", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: now - 40 * DAY_IN_MS,
		});
		const expiredUser = await insertUser(t, "utlopt@example.com");
		const expiredId = await insertRegistration(
			t,
			eventId,
			expiredUser._id,
			"pending",
			now - EXPIRED_OFFER_AGE_IN_MS,
		);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expiredId)).toBe("pending");
	});

	it("does not offer a seat past the participation limit", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const seatedUser = await insertUser(t, "sitter@example.com");
		await insertRegistration(t, eventId, seatedUser._id, "registered", now);
		const expiredUser = await insertUser(t, "utlopt@example.com");
		const expiredId = await insertRegistration(
			t,
			eventId,
			expiredUser._id,
			"pending",
			now - EXPIRED_OFFER_AGE_IN_MS,
		);
		const waitingUser = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(
			t,
			eventId,
			waitingUser._id,
			"waitlist",
			now - 10 * HOUR_IN_MS,
		);

		await t.mutation(waitlistMutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expiredId)).toBe("waitlist");
		expect(await statusOf(t, waitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([]);
	});
});

describe("clearWaitlistAndPending", () => {
	it("clears everyone who is not seated and tells them the seats are free for all", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, {
			participationLimit: 10,
			eventStart: now,
		});
		const seatedUser = await insertUser(t, "sitter@example.com");
		const seatedId = await insertRegistration(t, eventId, seatedUser._id, "registered", now);
		const offeredUser = await insertUser(t, "tilbudt@example.com");
		const offeredId = await insertRegistration(t, eventId, offeredUser._id, "pending", now + 1);
		const waitingUser = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(t, eventId, waitingUser._id, "waitlist", now + 2);

		await t.mutation(waitlistMutations.clearWaitlistAndPending, {});

		expect(await statusOf(t, seatedId)).toBe("registered");
		expect(await statusOf(t, offeredId)).toBeNull();
		expect(await statusOf(t, waitingId)).toBeNull();
		expect((await scheduledRecipientsOf(t, "sendFreeForAll")).sort()).toEqual([
			"tilbudt@example.com",
			"venter@example.com",
		]);
	});

	it("keeps the waitlist when the event is already full", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, {
			participationLimit: 1,
			eventStart: now,
		});
		const seatedUser = await insertUser(t, "sitter@example.com");
		await insertRegistration(t, eventId, seatedUser._id, "registered", now);
		const waitingUser = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(t, eventId, waitingUser._id, "waitlist", now + 1);

		await t.mutation(waitlistMutations.clearWaitlistAndPending, {});

		expect(await statusOf(t, waitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendFreeForAll")).toEqual([]);
	});

	it("leaves an event on another day alone", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, {
			participationLimit: 10,
			eventStart: now + DAY_IN_MS,
		});
		const waitingUser = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(t, eventId, waitingUser._id, "waitlist", now);

		await t.mutation(waitlistMutations.clearWaitlistAndPending, {});

		expect(await statusOf(t, waitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendFreeForAll")).toEqual([]);
	});

	it("drops a registration whose user is gone without emailing anyone", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, {
			participationLimit: 10,
			eventStart: now,
		});
		const departedUser = await insertUser(t, "slettet@example.com");
		const departedId = await insertRegistration(t, eventId, departedUser._id, "waitlist", now);
		await t.run((ctx) => ctx.db.delete(departedUser._id));

		await t.mutation(waitlistMutations.clearWaitlistAndPending, {});

		expect(await statusOf(t, departedId)).toBeNull();
		expect(await scheduledRecipientsOf(t, "sendFreeForAll")).toEqual([]);
	});

	it("clears an unpublished event too", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, {
			participationLimit: 10,
			eventStart: now,
			published: false,
		});
		const waitingUser = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(t, eventId, waitingUser._id, "waitlist", now);

		await t.mutation(waitlistMutations.clearWaitlistAndPending, {});

		expect(await statusOf(t, waitingId)).toBeNull();
	});
});

describe("fixWaitlist", () => {
	it("reports when the event is gone", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		await t.run((ctx) => ctx.db.delete(eventId));

		const result = await t.mutation(waitlistMutations.fixWaitlist, { eventId });

		expect(result).toBe("No event found");
	});

	it("offers every open seat to the front of the waitlist in order", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 3 });
		const seatedUser = await insertUser(t, "sitter@example.com");
		await insertRegistration(t, eventId, seatedUser._id, "registered", now);
		const firstWaiting = await insertUser(t, "venter-1@example.com");
		await insertRegistration(t, eventId, firstWaiting._id, "waitlist", now + 1);
		const secondWaiting = await insertUser(t, "venter-2@example.com");
		await insertRegistration(t, eventId, secondWaiting._id, "waitlist", now + 2);
		const thirdWaiting = await insertUser(t, "venter-3@example.com");
		const thirdWaitingId = await insertRegistration(
			t,
			eventId,
			thirdWaiting._id,
			"waitlist",
			now + 3,
		);

		await t.mutation(waitlistMutations.fixWaitlist, { eventId });

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

	it("counts outstanding offers as taken seats", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 3 });
		const seatedUser = await insertUser(t, "sitter@example.com");
		await insertRegistration(t, eventId, seatedUser._id, "registered", now);
		const offeredUser = await insertUser(t, "tilbudt@example.com");
		await insertRegistration(t, eventId, offeredUser._id, "pending", now + 1);
		const firstWaiting = await insertUser(t, "venter-1@example.com");
		await insertRegistration(t, eventId, firstWaiting._id, "waitlist", now + 2);
		const secondWaiting = await insertUser(t, "venter-2@example.com");
		const secondWaitingId = await insertRegistration(
			t,
			eventId,
			secondWaiting._id,
			"waitlist",
			now + 3,
		);

		await t.mutation(waitlistMutations.fixWaitlist, { eventId });

		expect(await emailsWithStatus(t, eventId, "pending")).toEqual([
			"tilbudt@example.com",
			"venter-1@example.com",
		]);
		expect(await statusOf(t, secondWaitingId)).toBe("waitlist");
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([
			"venter-1@example.com",
		]);
	});

	it("changes nothing when the event is full", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const seatedUser = await insertUser(t, "sitter@example.com");
		await insertRegistration(t, eventId, seatedUser._id, "registered", now);
		const waitingUser = await insertUser(t, "venter@example.com");
		const waitingId = await insertRegistration(t, eventId, waitingUser._id, "waitlist", now + 1);

		await t.mutation(waitlistMutations.fixWaitlist, { eventId });

		expect(await statusOf(t, waitingId)).toBe("waitlist");
		expect(await countRegistrationsForEvent(t, eventId)).toBe(2);
		expect(await scheduledRecipientsOf(t, "sendAvailableSeatEmail")).toEqual([]);
	});
});
