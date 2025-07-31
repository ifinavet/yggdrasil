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

    const registered = registrationsWithUsers.filter(reg => reg.status === "registered");
    const waitlistPending = registrationsWithUsers.filter(reg => reg.status === "pending" || reg.status === "waitlist");

    return {
      registered,
      waitlist: waitlistPending,
    };
  },
})

export const getCurrentUser = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const registrationsWithEvents = await Promise.all(registrations.map(async (reg) => {
      const event = await ctx.db.get(reg.eventId);
      if (!event) {
        throw new Error(`Event with ID ${reg.eventId} not found`);
      }

      return {
        ...reg,
        eventTitle: event.title,
        eventStart: event.eventStart,
      };
    }));

    return registrationsWithEvents
  }
});


export const remove = mutation({
  args: {
    id: v.id("registrations"),
  },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
})

export const updateAttendance = mutation({
  args: {
    id: v.id("registrations"),
    newStatus: v.union(v.literal("confirmed"), v.literal("late"), v.literal("no_show")),
  },
  handler: async (ctx, { id, newStatus }) => {
    await ctx.db.patch(id, {
      attendanceStatus: newStatus,
    });
  },
});
