import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { getCurrentUserOrThrow } from "../../auth/currentUser";
import { type TracedMutationCtx, tracedMutation } from "../../lib/trace";

/**
 * Accepts a pending registration for the current user.
 *
 * @param {Id<"registrations">} id - The id of the registration to accept.
 *
 * @throws - An error if the registration does not exist or does not belong to the current user.
 * @returns {null} - Returns null when the registration is accepted successfully.
 */
export const acceptPendingRegistration = tracedMutation({
	args: {
		id: v.id("registrations"),
	},
	handler: async (ctx, { id }) => {
		const user = await getCurrentUserOrThrow(ctx);

		const registration = await ctx.db.get(id);
		if (!registration) {
			throw new Error(`Registrering med ID ${id} ikke funnet. Kan ikke godta registrering.`);
		}

		if (registration.userId !== user._id) {
			throw new Error(
				`Registrering med ID ${id} tilhører ikke brukeren. Kan ikke godta. Utført av id ${user._id}, ${user.firstName} ${user.lastName}`,
			);
		}

		await ctx.db.patch(id, {
			status: "registered",
			registrationTime: Date.now(),
		});

		ctx.trace("registration_accepted", {
			registrationId: id,
			eventId: registration.eventId,
			userId: user._id,
		});
	},
});

/**
 * Updates the attendance status for a registration and applies points when needed.
 *
 * @param {Id<"registrations">} id - The id of the registration to update.
 * @param {"confirmed" | "late" | "no_show"} newStatus - The new attendance status.
 *
 * @throws - An error if the registration or related student cannot be resolved.
 * @returns {null} - Returns null when the attendance status is updated successfully.
 */
export const updateAttendance = tracedMutation({
	args: {
		id: v.id("registrations"),
		newStatus: v.union(v.literal("confirmed"), v.literal("late"), v.literal("no_show")),
	},
	handler: async (ctx, { id, newStatus }) => {
		await getCurrentUserOrThrow(ctx);

		const registration = await ctx.db.get(id);
		if (!registration) {
			throw new Error(
				`Registrering med ID ${id} ikke funnet. Kan ikke oppdatere deltakelsestatus.`,
			);
		}

		await ctx.db.patch(id, {
			attendanceStatus: newStatus,
			attendanceTime: Date.now(),
			status: registration.status === "pending" ? "registered" : registration.status,
		});

		ctx.trace("attendance_updated", {
			registrationId: id,
			eventId: registration.eventId,
			newStatus,
		});

		if (registration.status !== "registered") return;

		const student = await ctx.db
			.query("students")
			.withIndex("by_userId", (q) => q.eq("userId", registration.userId))
			.first();

		if (!student) {
			throw new Error(
				`Bruker med ID ${registration.userId} ikke funnet. Kan ikke oppdatere deltakelsestatus.`,
			);
		}

		const event = await ctx.db.get(registration.eventId);

		if (newStatus === "late" || newStatus === "no_show") {
			const severity = newStatus === "late" ? 1 : 2;
			const reason =
				newStatus === "late"
					? `Du fikk 1 prikk for å være for sen til arrangementet "${event?.title}".`
					: `Du fikk 2 prikker for å ikke møte til arrangementet "${event?.title}".`;

			ctx.trace("attendance_points_triggered", {
				registrationId: id,
				studentId: student._id,
				severity,
			});

			await ctx.runMutation(internal.points.mutations.givePointsInternal, {
				id: student._id,
				severity,
				reason,
				traceId: ctx.traceId,
			});

			await ctx.runMutation(internal.points.mutations.givePointsEmail, {
				userId: student.userId,
				severity,
				reason,
				traceId: ctx.traceId,
			});
		}
	},
});

/**
 * Registers the current user for an event.
 *
 * @param {Id<"events">} eventId - The id of the event to register for.
 * @param {string | undefined} note - The optional registration note.
 *
 * @throws - An error if the event does not exist.
 * @returns {"registered" | "waitlist" | undefined} - The resulting registration status, or undefined if the user was already registered.
 */
export const register = tracedMutation({
	args: {
		eventId: v.id("events"),
		note: v.optional(v.string()),
	},
	handler: async (ctx, { eventId, note }) => {
		const user = await getCurrentUserOrThrow(ctx);

		const event = await ctx.db.get(eventId);
		if (!event) {
			throw new Error(`aarangementet med ID ${eventId} ikke funnet.Kan ikke registrere.`);
		}

		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventIdStatusAndRegistrationTime", (q) => q.eq("eventId", eventId))
			.collect();

		if (registrations.some((registration) => registration.userId === user._id)) {
			ctx.trace("registration_skipped_duplicate", { eventId, userId: user._id });
			return;
		}

		const registrationCount = registrations.filter(
			(reg) => reg.status === "registered" || reg.status === "pending",
		).length;

		const status = registrationCount < event.participationLimit ? "registered" : "waitlist";

		const registrationId = await ctx.db.insert("registrations", {
			eventId,
			userId: user._id,
			status,
			note: note,
			registrationTime: Date.now(),
		});

		ctx.trace("registration_created", { eventId, registrationId, userId: user._id, status });

		return status;
	},
});

/**
 * Updates the note on a registration.
 *
 * @param {Id<"registrations">} id - The id of the registration to update.
 * @param {string | undefined} note - The updated optional note.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {null} - Returns null when the note is updated successfully.
 */
export const updateNote = tracedMutation({
	args: {
		id: v.id("registrations"),
		note: v.optional(v.string()),
	},
	handler: async (ctx, { id, note }) => {
		await getCurrentUserOrThrow(ctx);

		await ctx.db.patch(id, { note });

		ctx.trace("registration_note_updated", { registrationId: id });
	},
});

/**
 * Unregisters the current user from an event and advances the waitlist when needed.
 *
 * @param {Id<"registrations">} id - The id of the registration to remove.
 *
 * @throws - An error if the registration or event does not exist.
 * @returns {{ deletedRegistration: Doc<"registrations">, event: Doc<"events">, person: Doc<"users"> }} - Information about the removed registration.
 */
export const unregister = tracedMutation({
	args: {
		id: v.id("registrations"),
	},
	handler: async (ctx, { id }) => {
		const currentUser = await getCurrentUserOrThrow(ctx);

		const registration = await ctx.db.get(id);
		if (!registration) {
			throw new Error(`Registrering med ID ${id} ble ikke funnet. Avbryter avregistrering.`);
		}

		const event = await ctx.db.get(registration.eventId);
		if (!event) {
			throw new Error(
				`aarangement med ID ${registration.eventId} ble ikke funnet.Kan ikke behandle ventelisten.`,
			);
		}

		await ctx.db.delete(id);

		ctx.trace("registration_removed", {
			registrationId: id,
			eventId: registration.eventId,
			userId: currentUser._id,
			previousStatus: registration.status,
		});

		const returnData = {
			deletedRegistration: registration,
			event: event,
			person: currentUser,
		};

		if (registration.status === "waitlist") return returnData;

		const nextRegistration = await ctx.db
			.query("registrations")
			.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
				q.eq("eventId", registration.eventId).eq("status", "waitlist"),
			)
			.order("asc")
			.first();

		if (nextRegistration) {
			await makeStatusPending(ctx, nextRegistration, event);
		}

		const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

		if (event.eventStart - Date.now() < TWENTY_FOUR_HOURS && registration.status === "registered") {
			try {
				const student = await ctx.db
					.query("students")
					.withIndex("by_userId", (q) => q.eq("userId", registration.userId))
					.first();

				if (student) {
					ctx.trace("late_unregister_penalty", {
						registrationId: id,
						studentId: student._id,
						eventId: event._id,
					});

					await ctx.runMutation(internal.points.mutations.givePointsInternal, {
						id: student._id,
						severity: 1,
						reason: `Avregistrering fra aarangement ${event.title} mindre enn 24 timer før start.`,
						traceId: ctx.traceId,
					});
				}
			} catch (e) {
				ctx.trace(
					"late_unregister_penalty_failed",
					{ registrationId: id, error: e instanceof Error ? e.message : String(e) },
					"ERROR",
				);
				console.error("Failed to apply late unregister penalty:", e);
			}
		}

		return returnData;
	},
});

/**
 * Moves a registration to pending status and schedules the seat notification email.
 *
 * @param {TracedMutationCtx} ctx - The traced Convex mutation context.
 * @param {Doc<"registrations">} registrationToMakePending - The registration to update.
 * @param {Doc<"events">} event - The event the registration belongs to.
 *
 * @throws - An error if the user for the registration cannot be resolved.
 * @returns {Promise<void>} - Resolves when the registration has been updated and the email scheduled.
 */
export const makeStatusPending = async (
	ctx: TracedMutationCtx,
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

	ctx.trace("waitlist_promoted_to_pending", {
		registrationId: registrationToMakePending._id,
		eventId: event._id,
		userId: user._id,
	});

	await ctx.scheduler.runAfter(0, internal.emails.sendAvailableSeatEmail, {
		participantEmail: user.email,
		eventTitle: event.title,
		eventId: event._id,
		registrationId: registrationToMakePending._id,
		traceId: ctx.traceId,
	});
};
