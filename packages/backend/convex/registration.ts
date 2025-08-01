import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

export const getByEventId = query({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, { eventId }) => {
    const registrations = await ctx.db.query("registrations")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .collect();

    const registrationsWithUsers = await Promise.all(registrations.map(async (registration) => {
      const user = await ctx.db.get(registration.userId);
      return {
        ...registration,
        userName: user ? `${user.firstName} ${user.lastName}` : "Ukjent bruker",
        userEmail: user ? user.email : "Ukjent e-post",
      };
    }))

    const registeredPending = registrationsWithUsers.filter(reg => reg.status === "pending" || reg.status === "registered");
    const waitlist = registrationsWithUsers.filter(reg => reg.status === "waitlist");

    return {
      registered: registeredPending,
      waitlist: waitlist,
    };
  },
})

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
  }
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
    await getCurrentUserOrThrow(ctx);

    await ctx.db.patch(id, {
      status: "registered",
      registrationTime: Date.now(),
    })
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
      throw new Error(`Arrangemenetet med ID ${eventId} ikke funnet. Kan ikke registrere.`);
    }

    const registrations = await ctx.db.query("registrations")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .collect()

    const registrationCount = registrations.filter(reg => reg.status === "registered").length;

    const status = registrationCount < event.participationLimit ? "registered" : "waitlist";

    await ctx.db.insert("registrations", {
      eventId,
      userId: user._id,
      status,
      note: note,
      registrationTime: Date.now(),
    })

    return status;
  },
})

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
      throw new Error(`Arrangement med ID ${registration.eventId} ble ikke funnet. Kan ikke behandle ventelisten.`);
    }

    await ctx.db.delete(id);

    if (registration.status === "waitlist") return;

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_eventId", (q) => q.eq("eventId", registration.eventId))
      .collect();

    const nextRegistration = registrations
      .filter(reg => reg.status === "waitlist")
      .sort((a, b) => a._creationTime - b._creationTime)[0];

    if (!nextRegistration) {
      console.log(`No waitlist registrations found for event ${event.title}.`);
      return;
    };

    await ctx.db.patch(nextRegistration._id, {
      status: "pending",
      registrationTime: Date.now(),
    });
  },
});
