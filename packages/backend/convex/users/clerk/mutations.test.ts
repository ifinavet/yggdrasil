import { describe, expect, it, vi } from "vitest";
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
	const eventId = await insertEvent(t, companyId, { eventStart: Date.now() - 1 });
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
		expect(stored?.deleted).toBe(true);
		expect(stored?.externalId).not.toContain(user.externalId);
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
		expect(await t.run((ctx) => ctx.db.query("deletedClerkUsers").collect())).toHaveLength(1);
	});

	it("rejects student onboarding after the Clerk account was deleted", async () => {
		const { t, user } = await seedUserWithEveryReference();
		await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });
		await expect(
			asUser(t, user).mutation(api.users.students.mutations.createByExternalId, {
				externalId: user.externalId,
				name: "Old name",
				degree: "Bachelor",
				year: 1,
				studyProgram: "Informatikk",
			}),
		).rejects.toThrow("Denne brukeren er slettet.");
		expect(await t.run((ctx) => ctx.db.query("students").collect())).toEqual([]);
	});

	it("clears group leadership and revokes even the sole super-admin", async () => {
		const { t } = await setup();
		const user = await insertUser(t, "admin@example.com");
		const right = await grantRole(t, user._id, "super-admin");
		const group = await t.run((ctx) =>
			ctx.db.insert("internalGroups", {
				name: "Styret",
				description: "",
				leader: user._id,
			}),
		);
		await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });
		expect(await t.run((ctx) => ctx.db.get(right))).toBeNull();
		expect((await t.run((ctx) => ctx.db.get(group)))?.leader).toBeUndefined();
		expect(
			await asUser(t, user).query(api.auth.accessRights.checkRights, {
				right: ["super-admin"],
			}),
		).toBe(false);
	});

	it("scrubs feedback authors across batches while preserving answers and other authors", async () => {
		vi.useFakeTimers();
		try {
			const { t, user } = await seedUserWithEveryReference();
			const formId = await t.mutation(internal.forms.mutations.createEventFeedbackForm, {});
			await t.run(async (ctx) => {
				for (let i = 0; i < 105; i++) {
					await ctx.db.insert("formResponses", {
						formId,
						data: { userId: user.externalId, rating: 5 },
					});
				}
				await ctx.db.insert("formResponses", {
					formId,
					data: { userId: "someone_else", rating: 3 },
				});
			});
			await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });
			await t.finishAllScheduledFunctions(vi.runAllTimers);
			const responses = await t.run((ctx) => ctx.db.query("formResponses").collect());
			expect(
				responses.filter((response) => response.data.rating === 5).map((response) => response.data),
			).toEqual(Array.from({ length: 105 }, () => ({ rating: 5 })));
			expect(responses.find((response) => response.data.rating === 3)?.data).toEqual({
				userId: "someone_else",
				rating: 3,
			});
			const tombstones = await t.run((ctx) => ctx.db.query("deletedClerkUsers").collect());
			expect(tombstones[0]?.externalIdHash).toMatch(/^[a-f0-9]{64}$/);
			expect(JSON.stringify(tombstones)).not.toContain(user.externalId);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("reading records that belong to a deleted user", () => {
	it("skips a deleted user and offers the freed seat to the next live user", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const seated = await insertUser(t, "sitter@example.com");
		const seatedRegistration = await insertRegistration(t, eventId, seated._id, "registered");
		const deleted = await insertUser(t, "sletta@example.com");
		const waitlistedRegistration = await insertRegistration(t, eventId, deleted._id, "waitlist");
		const live = await insertUser(t, "venter@example.com");
		const liveRegistration = await insertRegistration(
			t,
			eventId,
			live._id,
			"waitlist",
			Date.now() + 1,
		);

		await t.mutation(deleteFromClerk, { clerkUserId: deleted.externalId });
		await asUser(t, seated).mutation(api.events.registrations.mutations.unregister, {
			id: seatedRegistration,
		});

		expect(await statusOf(t, waitlistedRegistration)).toBeNull();
		expect(await statusOf(t, liveRegistration)).toBe("pending");
		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		expect(scheduled).toHaveLength(1);
		expect(scheduled[0]?.args[0].participantEmail).toBe("venter@example.com");
	});

	it("shows the anonymized name in the registration list", async () => {
		const { t, companyId } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() - 1 });
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

	it.each(["registered", "pending", "waitlist"] as const)(
		"removes a future %s registration and fills available seats",
		async (status) => {
			const { t, companyId } = await setup();
			const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
			const deleted = await insertUser(t, "sletta@example.com");
			const registration = await insertRegistration(t, eventId, deleted._id, status);
			const live = await insertUser(t, "venter@example.com");
			const waiting = await insertRegistration(t, eventId, live._id, "waitlist", Date.now() + 1);
			await t.mutation(deleteFromClerk, { clerkUserId: deleted.externalId });
			expect(await statusOf(t, registration)).toBeNull();
			expect(await statusOf(t, waiting)).toBe("pending");
		},
	);

	it.each(["confirmed", "late", "no_show"] as const)(
		"allows retained attendance to be marked %s without points or email",
		async (newStatus) => {
			const { t, user, registrationId } = await seedUserWithEveryReference();
			const admin = await insertUser(t, "admin@example.com");
			await grantRole(t, admin._id, "admin");
			await t.run((ctx) => ctx.db.patch(registrationId, { note: "Personal dietary details" }));
			await t.mutation(deleteFromClerk, { clerkUserId: user.externalId });
			await asUser(t, admin).mutation(api.events.registrations.mutations.updateAttendance, {
				id: registrationId,
				newStatus,
			});
			const registration = await t.run((ctx) => ctx.db.get(registrationId));
			expect(registration?.attendanceStatus).toBe(newStatus);
			expect(registration?.note).toBeUndefined();
			expect(await t.run((ctx) => ctx.db.query("points").collect())).toEqual([]);
			expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual(
				[],
			);
		},
	);
});
