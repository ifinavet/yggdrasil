import { toBase64 } from "@workspace/shared/utils";
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getCurrentUserOrThrow } from "../../auth/currentUser";

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

export const getCurrentUserRegistertToEventBySlug = query({
    args: {
        slug: v.string(),
    },
    handler: async (ctx, { slug }) => {
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .first();

        if (!event) {
            throw new Error(`Arrangement med slug ${slug} ikke funnet.`);
        }

        const user = await getCurrentUserOrThrow(ctx);

        const registrations = await ctx.db
            .query("registrations")
            .withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
                q.eq("eventId", event._id).eq("status", "registered"),
            )
            .filter((q) => q.eq(q.field("userId"), user._id))
            .first();

        if (!registrations) {
            throw new Error(`Bruker er ikke registrert på arrangementet med slug ${slug}.`);
        }

        return user._id;
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
                        `aarangementet med ID ${reg.eventId} ikke funnet. Kan ikke hente registrering.`,
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

export const getUserByRegistrationId = query({
    args: {
        id: v.id("registrations"),
    },
    handler: async (ctx, { id }) => {
        const registration = await ctx.db.get(id);
        if (!registration) return null;

        const user = await ctx.db.get(registration.userId);
        if (!user) return null;

        return { ...registration, ...user };
    },
});

export const getRegistrantsInfo = query({
    args: {
        eventId: v.id("events"),
    },
    handler: async (ctx, { eventId }) => {
        const registrations = await ctx.db
            .query("registrations")
            .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
            .filter((r) => r.eq(r.field("status"), "registered"))
            .collect();

        const studentsInfo = await Promise.all(
            registrations.map(async (registration) => {
                const student = await ctx.db
                    .query("students")
                    .withIndex("by_userId", (q) => q.eq("userId", registration.userId))
                    .first();

                return {
                    aar: student?.year ?? -1,
                    program: student?.studyProgram ?? "Ukjent",
                    degree: student?.degree ?? "Ukjent",
                };
            }),
        );

        const result: {
            [degree: string]: {
                [program: string]: {
                    [aar: number]: number;
                };
            };
        } = {};

        for (const info of studentsInfo) {
            const { degree, program, aar } = info;
            const programBase = toBase64(program);
            if (!result[degree]) result[degree] = {};

            if (!result[degree][programBase]) result[degree][programBase] = {};

            result[degree][programBase][aar] ??= 0;

            result[degree][programBase][aar]++;
        }

        return result;
    },
});