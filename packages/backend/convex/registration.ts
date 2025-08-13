import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

export const getByEventId = query({
	args: {
		eventId: v.id("events"),
	},
	handler: async (ctx, { eventId }) => {
		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventIdAndRegistrationTime", (q) => q.eq("eventId", eventId))
			.collect();

		const registrationsWithUsers = await Promise.all(
			registrations.map(async (registration) => {
				const user = await ctx.db.get(registration.userId);
				return {
					...registration,
					userName: user ? `${user.firstName} ${user.lastName}` : "Ukjent bruker",
					userEmail: user ? user.email : "Ukjent e-post",
				};
			}),
		);

		const registeredPending = registrationsWithUsers.filter(
			(reg) => reg.status === "pending" || reg.status === "registered",
		);
		const waitlist = registrationsWithUsers.filter((reg) => reg.status === "waitlist");

		return {
			registered: registeredPending,
			waitlist: waitlist,
		};
	},
});

export const getById = query({
	args: {
		id: v.id("registrations"),
	},
	handler: async (ctx, { id }) => {
		const registration = await ctx.db.get(id);

		if (!registration) {
			throw new Error(`Registrering med ID ${id} ikke funnet.`);
		}

		return registration;
	},
});

export const getCurrentUser = query({
	handler: async (ctx) => {
		const user = await getCurrentUserOrThrow(ctx);

		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.collect();

		const registrationsWithEvents = await Promise.all(
			registrations.map(async (reg) => {
				const event = await ctx.db.get(reg.eventId);
				if (!event) {
					throw new Error(
						`Arrangemenetet med ID ${reg.eventId} ikke funnet. Kan ikke hente registrering.`,
					);
				}

				return {
					...reg,
					eventTitle: event.title,
					eventStart: event.eventStart,
				};
			}),
		);

		return registrationsWithEvents;
	},
});

export const acceptPendingRegistration = mutation({
	args: {
		id: v.id("registrations"),
	},
	handler: async (ctx, { id }) => {
		const user = await getCurrentUserOrThrow(ctx);

		const registration = await ctx.db.get(id);
		if (!registration) {
			throw new Error(`Registrering med ID ${id} ikke funnet. Kan ikke godtå registrering.`);
		}

		if (registration.userId !== user._id) {
			throw new Error(
				`Registrering med ID ${id} tilhører ikke brukeren. Kan ikke godtå. Utført av id ${user._id}, ${user.firstName} ${user.lastName}`,
			);
		}

		await ctx.db.patch(id, {
			status: "registered",
			registrationTime: Date.now(),
		});
	},
});

export const updateAttendance = mutation({
	args: {
		id: v.id("registrations"),
		newStatus: v.union(v.literal("confirmed"), v.literal("late"), v.literal("no_show")),
	},
	handler: async (ctx, { id, newStatus }) => {
		await getCurrentUserOrThrow(ctx);

		await ctx.db.patch(id, {
			attendanceStatus: newStatus,
			attendanceTime: Date.now(),
		});

		const registration = await ctx.db.get(id);
		if (!registration) {
			throw new Error(
				`Registrering med ID ${id} ikke funnet. Kan ikke oppdatere deltakelsesstatus.`,
			);
		}

		const user = await ctx.db.get(registration.userId);
		const student = await ctx.db
			.query("students")
			.withIndex("by_userId", (q) => q.eq("userId", registration.userId))
			.first();

		if (!user || !student) {
			throw new Error(
				`Bruker med ID ${registration.userId} ikke funnet. Kan ikke oppdatere deltakelsesstatus.`,
			);
		}

		const event = await ctx.db.get(registration.eventId);

		if (newStatus === "late" || newStatus === "no_show") {
			const severity = newStatus === "late" ? 1 : 2;
			const reason =
				newStatus === "late"
					? `Du fikk 1 prikk for å være for sen til arrangementet "${event?.title}".`
					: `Du fikk 2 prikker for å ikke møte til arrangementet "${event?.title}".`;

			await ctx.runMutation(internal.points.givePointsInternal, {
				id: student._id,
				severity,
				reason,
			});

			await ctx.runMutation(internal.points.givePointsEmail, {
				userId: user._id,
				severity,
				reason,
			});
		}
	},
});

export const register = mutation({
	args: {
		eventId: v.id("events"),
		note: v.optional(v.string()),
	},
	handler: async (ctx, { eventId, note }) => {
		const user = await getCurrentUserOrThrow(ctx);

		const event = await ctx.db.get(eventId);
		if (!event) {
			throw new Error(`Arrangemenetet med ID ${eventId} ikke funnet.Kan ikke registrere.`);
		}

		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventIdStatusAndRegistrationTime", (q) => q.eq("eventId", eventId))
			.collect();

		const registrationCount = registrations.filter(
			(reg) => reg.status === "registered" || reg.status === "pending",
		).length;

		const status = registrationCount < event.participationLimit ? "registered" : "waitlist";

		await ctx.db.insert("registrations", {
			eventId,
			userId: user._id,
			status,
			note: note,
			registrationTime: Date.now(),
		});

		return status;
	},
});

export const updateNote = mutation({
	args: {
		id: v.id("registrations"),
		note: v.optional(v.string()),
	},
	handler: async (ctx, { id, note }) => {
		await getCurrentUserOrThrow(ctx);

		await ctx.db.patch(id, { note });
	},
});

export const unregister = mutation({
	args: {
		id: v.id("registrations"),
	},
	handler: async (ctx, { id }) => {
		await getCurrentUserOrThrow(ctx);

		const registration = await ctx.db.get(id);
		if (!registration) {
			throw new Error(`Registreing med ID ${id} ble ikke funnet. Avbryter avregistrering.`);
		}

		const event = await ctx.db.get(registration.eventId);
		if (!event) {
			throw new Error(
				`Arrangement med ID ${registration.eventId} ble ikke funnet.Kan ikke behandle ventelisten.`,
			);
		}

		await ctx.db.delete(id);

		if (event.eventStart - Date.now() < 24 * 60 * 60 * 1000) {
			const student = await ctx.db
				.query("students")
				.withIndex("by_userId", (q) => q.eq("userId", registration.userId))
				.first();

			if (!student) {
				throw new Error(`Studentent med bruker - ID ${registration.userId} ble ikke funnet.`);
			}

			await ctx.runMutation(internal.points.givePointsInternal, {
				id: student._id,
				severity: 1,
				reason: `Avregistrering fra arrangement ${event.title} mindre enn 24 timer før start.`,
			});
		}

		const returnData = {
			deletedRegistration: registration,
			event: event,
		};

		if (registration.status === "waitlist") return returnData;

		const nextRegistration = await ctx.db
			.query("registrations")
			.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
				q.eq("eventId", registration.eventId).eq("status", "waitlist"),
			)
			.first();

		if (!nextRegistration) return returnData;

		await makeStatusPending(ctx, nextRegistration, event);

		return returnData;
	},
});

export const checkPendingRegistrations = internalMutation({
	handler: async (ctx) => {
		const now = Date.now();
		const activeEvents = (
			await ctx.db
				.query("events")
				.withIndex("by_registrationOpens", (q) => q.lte("registrationOpens", now))
				.collect()
		).filter((e) => e.eventStart > now + 2 * 60 * 60 * 1000);

		await Promise.all(
			activeEvents.map(async (event) => {
				const pendingRegistrations = await ctx.db
					.query("registrations")
					.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
						q.eq("eventId", event._id).eq("status", "pending"),
					)
					.collect();

				if (pendingRegistrations.length > 0) {
					await Promise.all(
						pendingRegistrations.map(async (registration) => {
							if (registration.registrationTime >= now - 24 * 60 * 60 * 1000) {
								await ctx.db.patch(registration._id, {
									status: "waitlist",
									registrationTime: Date.now(),
								});

								const nextRegistration = await ctx.db
									.query("registrations")
									.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
										q.eq("eventId", event._id).eq("status", "waitlist"),
									)
									.first();

								if (!nextRegistration) return;
								await makeStatusPending(ctx, nextRegistration, event);
							}
						}),
					);
				}
			}),
		);
	},
});

export const makeStatusPending = async (
	ctx: MutationCtx,
	registrationToMakePending: Doc<"registrations">,
	event: Doc<"events">,
) => {
	const user = await ctx.db.get(registrationToMakePending.userId);
	if (!user) {
		throw new Error(
			`Bruker med ID ${registrationToMakePending.userId} ikke funnet. Kan ikke oppdatere registrering.`,
		);
	}

	await ctx.db.patch(registrationToMakePending._id, {
		status: "pending",
		registrationTime: Date.now(),
	});

	await ctx.scheduler.runAfter(0, internal.emails.sendAvailableSeatEmail, {
		participantEmail: user.email,
		eventTitle: event.title,
		eventId: event._id,
		registrationId: registrationToMakePending._id,
	});
};
