import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { makeStatusPending } from "./registration";

export const checkPendingRegistrations = internalMutation({
	handler: async (ctx) => {
		const ONE_HOUR_MS = 60 * 60 * 1000;
		const ONE_MONTH_MS = 30 * 24 * ONE_HOUR_MS;
		const ANSWER_TIME_LIMIT_MS = 16 * ONE_HOUR_MS;

		const now = Date.now();

		// Get all event where we care if there are any pending registrations.
		// We only care about the one where registration is open and it is less than one hours since the event has started
		// This is to offset for the fact that the cron only runs every two hours.
		const eventsWithOpenRegistrations = await ctx.db
			.query("events")
			.withIndex("by_registrationOpens", (q) =>
				q.gte("registrationOpens", now - ONE_MONTH_MS).lte("registrationOpens", now),
			)
			.filter((q) => q.gte(q.field("eventStart"), now - ONE_HOUR_MS))
			.filter((q) => q.eq(q.field("externalUrl"), ""))
			.filter((q) => q.eq(q.field("published"), true))
			.collect();

		// Get all the pending registrations.
		const pendingRegistrations = (
			await Promise.all(
				eventsWithOpenRegistrations.map(
					async (event) =>
						await ctx.db
							.query("registrations")
							.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
								q.eq("eventId", event._id).eq("status", "pending"),
							)
							.order("asc")
							.collect(),
				),
			)
		).flat();

		// Check and update all the pending registrations that have been pending for more than 16 hours.
		await Promise.all(
			pendingRegistrations.map(async (registration) => {
				if (now - registration.registrationTime > ANSWER_TIME_LIMIT_MS) {
					// Move to the back of the waitlist
					await ctx.db.patch(registration._id, {
						status: "waitlist",
						registrationTime: now,
					});

					// Find the next on the waitlist to be offered a place
					const nextRegistration = await ctx.db
						.query("registrations")
						.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
							q.eq("eventId", registration.eventId).eq("status", "waitlist"),
						)
						.order("desc")
						.first();

					if (!nextRegistration) return;
					const event = eventsWithOpenRegistrations.find((e) => e._id === registration.eventId);
					if (!event) throw new Error("Ingen arrangement assosiert med registreringen.");

					await makeStatusPending(ctx, nextRegistration, event);
				}
			}),
		);
	},
});

export const clearWaitlistAndPending = internalMutation({
	handler: async (ctx) => {
		const now = Date.now();
		const startOfDay = new Date(now);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(now);
		endOfDay.setHours(23, 59, 59, 999);

		const eventsToClear = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (q) =>
				q.gte("eventStart", startOfDay.getTime()).lte("eventStart", endOfDay.getTime()))
			.collect();

		const registrationsForEvents = await Promise.all(
			eventsToClear.map(async (event) => {
				const registrations = await ctx.db
					.query("registrations")
					.withIndex("by_eventId", q => q.eq("eventId", event._id))
					.collect();

				return {
					event,
					registrations
				};
			}),
		);

		console.log(registrationsForEvents)

		await Promise.all(registrationsForEvents.map(async ({ event, registrations }) => {
			const availablePlaces = event.participationLimit - registrations.filter((reg) => reg.status === "registered").length;
			if (availablePlaces === 0) return;

			// Delete and notify the students on the waitlist
			await Promise.all(
				registrations
					.filter((reg) => reg.status !== "registered")
					.map(async (reg) => {
						const user = await ctx.db.get(reg.userId);
						if (!user) {
							await ctx.db.delete(reg._id);
							return;
						}

						// Notify registrant of the free-for all
						await ctx.scheduler.runAfter(0, internal.emails.sendFreeForAll, {
							participantEmail: user.email,
							eventId: event._id,
							eventTitle: event.title,
							availableSeats: availablePlaces,
						});

						// Delete registrations
						await ctx.db.delete(reg._id);
					}));
		}));
	},
});

export const fixWaitlist = internalMutation({
	args: {
		eventId: v.id("events")
	},
	handler: async (ctx, { eventId }) => {
		const event = await ctx.db.get(eventId)
		if (!event) return "No event found";

		const registrations = await ctx.db.query("registrations").withIndex("by_eventIdStatusAndRegistrationTime", q => q.eq("eventId", eventId).eq("status", "registered")).collect();
		const pending = await ctx.db.query("registrations").withIndex("by_eventIdStatusAndRegistrationTime", q => q.eq("eventId", eventId).eq("status", "pending")).collect();

		console.log(registrations.length + pending.length, event.participationLimit);

		const numRegisteredAndPending = (registrations.length + pending.length)
		if (numRegisteredAndPending < event.participationLimit) {
			const waitlist = await ctx.db.query("registrations").withIndex("by_eventIdStatusAndRegistrationTime", q => q.eq("eventId", eventId).eq("status", "waitlist")).collect();

			await Promise.all(waitlist.slice(0, event.participationLimit - numRegisteredAndPending).map(async (reg) => {

				await makeStatusPending(ctx, reg, event);
			}))
		}
	}
})
