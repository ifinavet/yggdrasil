import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { Doc } from "../../_generated/dataModel";
import { mutation, MutationCtx } from "../../_generated/server";
import { getCurrentUserOrThrow } from "../../auth/currentUser";

/**
 * Accepts a pending registration for the current user.
 *
 * @param {Id<"registrations">} id - The id of the registration to accept.
 *
 * @throws - An error if the registration does not exist or does not belong to the current user.
 * @returns {null} - Returns null when the registration is accepted successfully.
 */
export const acceptPendingRegistration = mutation({
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
export const updateAttendance = mutation({
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
                    ? `Du fikk 1 prikk for å være for sen til aarangementet "${event?.title}".`
                    : `Du fikk 2 prikker for å ikke møte til aarangementet "${event?.title}".`;

            await ctx.runMutation(internal.points.mutations.givePointsInternal, {
                id: student._id,
                severity,
                reason,
            });

            await ctx.runMutation(internal.points.mutations.givePointsEmail, {
                userId: student.userId,
                severity,
                reason,
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
export const register = mutation({
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

        if (registrations.some((registration) => registration.userId === user._id)) return;

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

/**
 * Updates the note on a registration.
 *
 * @param {Id<"registrations">} id - The id of the registration to update.
 * @param {string | undefined} note - The updated optional note.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {null} - Returns null when the note is updated successfully.
 */
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

/**
 * Unregisters the current user from an event and advances the waitlist when needed.
 *
 * @param {Id<"registrations">} id - The id of the registration to remove.
 *
 * @throws - An error if the registration or event does not exist.
 * @returns {{ deletedRegistration: Doc<"registrations">, event: Doc<"events">, person: Doc<"users"> }} - Information about the removed registration.
 */
export const unregister = mutation({
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
                    await ctx.runMutation(internal.points.mutations.givePointsInternal, {
                        id: student._id,
                        severity: 1,
                        reason: `Avregistrering fra aarangement ${event.title} mindre enn 24 timer før start.`,
                    });
                }
            } catch (e) {
                console.error("Failed to apply late unregister penalty:", e);
            }
        }

        return returnData;
    },
});

/**
 * Moves a registration to pending status and schedules the seat notification email.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"registrations">} registrationToMakePending - The registration to update.
 * @param {Doc<"events">} event - The event the registration belongs to.
 *
 * @throws - An error if the user for the registration cannot be resolved.
 * @returns {Promise<void>} - Resolves when the registration has been updated and the email scheduled.
 */
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
