import { describe, expect, it } from "vitest";
import {
	asUser,
	givePointsTo,
	grantRole,
	insertEvent,
	insertInternal,
	insertOrganizer,
	insertRegistration,
	insertStudent,
	insertUser,
	setup,
	statusOf,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";

const deleteFromClerk = internal.users.clerk.mutations.deleteFromClerk;

async function seedUserWithEveryReference() {
	const { t, companyId } = await setup();
	const user = await insertUser(t, "sletta@example.com");
	const accessRightsId = await grantRole(t, user._id, "admin");
	const studentId = await insertStudent(t, user._id);
	const pointsId = await givePointsTo(t, studentId, 2);
	const internalId = await insertInternal(t, user._id, "Leder");
	const eventId = await insertEvent(t, companyId);
	const registrationId = await insertRegistration(t, eventId, user._id, "registered");
	const organizerId = await insertOrganizer(t, eventId, user._id);

	return {
		t,
		user,
		accessRightsId,
		studentId,
		pointsId,
		internalId,
		eventId,
		registrationId,
		organizerId,
	};
}

describe("deleting a user from Clerk", () => {
	it("anonymizes the user row instead of removing it", async () => {
		const { t, user } = await seedUserWithEveryReference();

		await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });

		const stored = await t.run((ctx) => ctx.db.get(user._id));
		expect(stored).not.toBeNull();
		expect(stored?.email).toBe("");
		expect(`${stored?.firstName} ${stored?.lastName}`).toBe("Slettet bruker");
		expect(stored?.image).toBe("");
		expect(stored?.locked).toBe(true);
	});

	it("makes the anonymized user unreachable through the Clerk id", async () => {
		const { t, user } = await seedUserWithEveryReference();

		await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });

		const byExternalId = await t.run((ctx) =>
			ctx.db
				.query("users")
				.withIndex("by_ExternalId", (q) => q.eq("externalId", user.externalId))
				.first(),
		);
		expect(byExternalId).toBeNull();
	});

	it("removes the personal records that only exist for that user", async () => {
		const { t, user, accessRightsId, studentId, pointsId, internalId } =
			await seedUserWithEveryReference();

		await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });

		const remaining = await t.run(async (ctx) => ({
			accessRights: await ctx.db.get(accessRightsId),
			student: await ctx.db.get(studentId),
			points: await ctx.db.get(pointsId),
			internal: await ctx.db.get(internalId),
		}));
		expect(remaining).toEqual({
			accessRights: null,
			student: null,
			points: null,
			internal: null,
		});
	});

	it("keeps the event history attached to the anonymized user", async () => {
		const { t, user, registrationId, organizerId } = await seedUserWithEveryReference();

		await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });

		const history = await t.run(async (ctx) => ({
			registration: await ctx.db.get(registrationId),
			organizer: await ctx.db.get(organizerId),
		}));
		expect(history.registration?.userId).toBe(user._id);
		expect(history.registration?.status).toBe("registered");
		expect(history.organizer?.userId).toBe(user._id);
	});

	it("handles a repeated delete event for the same Clerk id", async () => {
		const { t, user } = await seedUserWithEveryReference();

		await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });
		await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });

		const users = await t.run((ctx) => ctx.db.query("users").collect());
		expect(users).toHaveLength(1);
		expect(users[0]?.email).toBe("");
	});
});

describe("reading records that belong to a deleted user", () => {
	it("promotes a waitlisted registration that belongs to the deleted user", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const seated = await insertUser(t, "sitter@example.com");
		const seatedRegistration = await insertRegistration(t, eventId, seated._id, "registered");
		const deleted = await insertUser(t, "sletta@example.com");
		const waitlistedRegistration = await insertRegistration(t, eventId, deleted._id, "waitlist");

		await t.mutation(deleteFromClerk, { clerkUserId: deleted.externalId });
		await asUser(t, seated).mutation(api.events.registrations.mutations.unregister, {
			id: seatedRegistration,
		});

		expect(await statusOf(t, waitlistedRegistration)).toBe("pending");
	});

	it("shows the anonymized name in the registration list", async () => {
		const { t, companyId } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const eventId = await insertEvent(t, companyId);
		const deleted = await insertUser(t, "sletta@example.com");
		await insertRegistration(t, eventId, deleted._id, "registered");

		await t.mutation(deleteFromClerk, { clerkUserId: deleted.externalId });

		const lists = await asUser(t, admin).query(api.events.registrations.queries.getByEventId, {
			eventIdentifier: eventId,
		});
		expect(lists.registered).toHaveLength(1);
		expect(lists.registered[0]?.userName).toBe("Slettet bruker");
	});

	it("returns no board member for a position the deleted user held", async () => {
		const { t } = await setup();
		const deleted = await insertUser(t, "sletta@example.com");
		await insertInternal(t, deleted._id, "Leder");

		await t.mutation(deleteFromClerk, { clerkUserId: deleted.externalId });

		const member = await t.query(api.users.organization.queries.getBoardMemberByPosition, {
			position: "Leder",
		});
		expect(member).toBeNull();
	});

	it("leaves no points behind for the deleted student", async () => {
		const { t } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const deleted = await insertUser(t, "sletta@example.com");
		const studentId = await insertStudent(t, deleted._id);
		await givePointsTo(t, studentId, 2);

		await t.mutation(deleteFromClerk, { clerkUserId: deleted.externalId });

		const overview = await asUser(t, admin).query(api.users.students.queries.getAllWithPoints, {});
		expect(overview).toEqual([]);
	});
});
