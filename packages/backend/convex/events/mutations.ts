import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { internalMutation, mutation, MutationCtx } from "../_generated/server";
import { getCurrentUserOrThrow } from "../auth/currentUser";
import { makeStatusPending } from "./registrations/mutations";

// Shared validator for organizer roles
const organizerRoleValidator = v.union(v.literal("hovedansvarlig"), v.literal("medhjelper"));

export const update = mutation({
    args: {
        id: v.id("events"),
        title: v.string(),
        teaser: v.string(),
        description: v.string(),
        eventStart: v.number(),
        registrationOpens: v.number(),
        participationLimit: v.number(),
        location: v.string(),
        food: v.string(),
        language: v.string(),
        ageRestriction: v.string(),
        externalUrl: v.optional(v.string()),
        hostingCompany: v.id("companies"),
        published: v.boolean(),
        organizers: v.array(
            v.object({
                userId: v.id("users"),
                role: organizerRoleValidator,
            }),
        ),
    },
    handler: async (
        ctx,
        {
            id: eventId,
            title,
            teaser,
            description,
            eventStart,
            registrationOpens,
            participationLimit,
            location,
            food,
            language,
            ageRestriction,
            externalUrl,
            hostingCompany,
            published,
            organizers,
        },
    ) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        const event = await ctx.db.get(eventId);
        if (!event) {
            throw new Error("Event not found");
        }

        // Create a slug if it doesn't exist
        const slug = event.slug || slugify(title, new Date(eventStart));

        let formId: Id<"form">;
        if (event.formId) {
            formId = event.formId;
        } else {
            // Creating the feedback form for after the event, if it does not already exist
            formId = await ctx.runMutation(internal.forms.mutations.createEventFeedbackForm);
            if (!formId) {
                console.error("Failed to create feedback form");
            }
        }

        // Update the event details
        await ctx.db.replace(eventId, {
            title,
            teaser,
            description,
            eventStart,
            registrationOpens,
            participationLimit,
            location,
            food,
            language,
            ageRestriction,
            externalUrl,
            hostingCompany,
            published,
            slug,
            formId,
        });

        await ctx.runMutation(internal.events.mutations.upsertEventOrganizer, {
            id: eventId,
            updatedOrganizers: organizers,
        });

        const waitlistLength = await ctx.db
            .query("registrations")
            .withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
                q.eq("eventId", eventId).eq("status", "waitlist"),
            )
            .collect();

        if (participationLimit - event.participationLimit > 0 && waitlistLength)
            await updateWaitlist(ctx, event._id, participationLimit - event.participationLimit);
    },
});

export const upsertEventOrganizer = internalMutation({
    args: {
        id: v.id("events"),
        updatedOrganizers: v.array(
            v.object({
                userId: v.id("users"),
                role: organizerRoleValidator,
            }),
        ),
    },
    handler: async (ctx, { id, updatedOrganizers }) => {
        await getCurrentUserOrThrow(ctx);

        const eventOrganizers = await ctx.db
            .query("eventOrganizers")
            .withIndex("by_eventId", (q) => q.eq("eventId", id))
            .collect();

        const organizersToRemove = eventOrganizers
            .filter((org) => !updatedOrganizers.some(({ userId }) => userId === org.userId))
            .map((org) => ctx.db.delete(org._id));

        const organizersToAdd = updatedOrganizers
            .filter(({ userId }) => !eventOrganizers.some((org) => org.userId === userId))
            .map((org) =>
                ctx.db.insert("eventOrganizers", {
                    eventId: id,
                    userId: org.userId,
                    role: org.role,
                }),
            );

        const organizersToUpdate = updatedOrganizers
            .filter(({ userId, role }) => {
                const existing = eventOrganizers.find((org) => org.userId === userId);
                return existing && existing.role !== role;
            })
            .map((org) => {
                const existing = eventOrganizers.find((eOrg) => eOrg.userId === org.userId);
                if (existing) {
                    ctx.db.patch(existing._id, { role: org.role });
                }
            });

        await Promise.all([...organizersToRemove, ...organizersToAdd, ...organizersToUpdate]);
    },
});

export const updateWaitlistMutation = internalMutation({
    args: {
        eventId: v.id("events"),
        numOfNewPlaces: v.number(),
    },
    handler: async (ctx, { eventId, numOfNewPlaces }) => {
        await updateWaitlist(ctx, eventId, numOfNewPlaces);
    },
});

export const updateWaitlist = async (
    ctx: MutationCtx,
    eventId: Id<"events">,
    numOfNewPlaces: number,
) => {
    const waitlistRegistrations = await ctx.db
        .query("registrations")
        .withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
            q.eq("eventId", eventId).eq("status", "waitlist"),
        )
        .order("asc")
        .collect();

    const event = await ctx.db.get(eventId);
    if (!event) {
        throw new Error(`Event not for eventId: ${eventId}`);
    }

    await Promise.all(
        waitlistRegistrations
            .slice(0, numOfNewPlaces)
            .map(async (registration) => await makeStatusPending(ctx, registration, event)),
    );
};

export const updatePublishedStatus = mutation({
    args: {
        ids: v.array(v.id("events")),
        newPublishedStatus: v.boolean(),
    },
    handler: async (ctx, { ids, newPublishedStatus }) => {
        await getCurrentUserOrThrow(ctx);

        await Promise.all(
            ids.map(async (id) => {
                await ctx.db.patch(id, { published: newPublishedStatus });
            }),
        );
    },
});

// Not meant for security purposes
function simpleHash(str: string): string {
    const hash = Math.abs(str.split("").reduce((a, b) => (a << 5) - a + (b.codePointAt(0) || 0), 0));
    const result = hash.toString(36).toUpperCase();
    return result.length < 4 ? result.padStart(4, "0").substring(0, 4) : result.substring(0, 4);
}

function slugify(title: string, eventDate: Date): string {
    let slugTitle = title
        .normalize("NFD")
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-");

    if (slugTitle.length === 0) slugTitle = simpleHash(title).toLowerCase();

    const semester = eventDate.getMonth() >= 7 ? "h" : "v";

    return `${semester}${eventDate.getFullYear().toString().slice(2)}-${slugTitle}-${simpleHash(title)}`;
}

export const create = mutation({
    args: {
        title: v.string(),
        teaser: v.string(),
        description: v.string(),
        eventStart: v.number(),
        registrationOpens: v.number(),
        participationLimit: v.number(),
        location: v.string(),
        food: v.string(),
        language: v.string(),
        ageRestriction: v.string(),
        externalUrl: v.optional(v.string()),
        hostingCompany: v.id("companies"),
        published: v.boolean(),
        organizers: v.array(
            v.object({
                userId: v.id("users"),
                role: organizerRoleValidator,
            }),
        ),
    },
    handler: async (
        ctx,
        {
            title,
            teaser,
            description,
            eventStart,
            registrationOpens,
            participationLimit,
            location,
            food,
            language,
            ageRestriction,
            externalUrl,
            hostingCompany,
            published,
            organizers,
        },
    ) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        // Creating the feedback form for after the event
        const formId = await ctx.runMutation(internal.forms.mutations.createEventFeedbackForm);
        if (!formId) {
            console.error("Failed to create feedback form");
        }

        const eventId = await ctx.db.insert("events", {
            title,
            teaser,
            description,
            eventStart,
            registrationOpens,
            participationLimit,
            location,
            food,
            language,
            ageRestriction,
            externalUrl,
            hostingCompany,
            published,
            slug: slugify(title, new Date(eventStart)),
            formId,
        });

        await Promise.all(
            organizers.map(
                async ({ userId, role }) =>
                    await ctx.db.insert("eventOrganizers", {
                        eventId,
                        userId,
                        role,
                    }),
            ),
        );
    },
});
