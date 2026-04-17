import { ORGANIZER_ROLE } from "@workspace/shared/constants";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { internalQuery, query, QueryCtx } from "../_generated/server";

/**
 * Fetches the next published events from the current week onward.
 *
 * @param {number} n - The maximum number of events to return.
 *
 * @returns {Array<Doc<"events"> & { organizers: Awaited<ReturnType<typeof getOrganizers>> }>} - The upcoming events with organizer details.
 */
export const getLatest = query({
    args: {
        n: v.number(),
    },
    handler: async (ctx, { n }) => {
        const firstDayOfThisWeek = new Date(
            new Date().setDate(new Date().getDate() - new Date().getDay()),
        );

        const events = await ctx.db
            .query("events")
            .withIndex("by_eventStart", (q) => q.gte("eventStart", firstDayOfThisWeek.getTime()))
            .filter((q) => q.eq(q.field("published"), true))
            .order("asc")
            .take(n);

        const eventWithOrganizers = await Promise.all(
            events.map(async (event) => {
                const organizers = await getOrganizers(ctx, event._id);

                return { ...event, organizers };
            }),
        );

        return eventWithOrganizers;
    },
});

/**
 * Fetches the next published upcoming events.
 *
 * @param {number} n - The maximum number of events to return.
 *
 * @returns {Doc<"events">[]} - The upcoming published events.
 */
export const getUpcoming = query({
    args: {
        n: v.number(),
    },
    handler: async (ctx, { n }) => {
        const events = await ctx.db
            .query("events")
            .withIndex("by_eventStart", (q) => q.gte("eventStart", Date.now()))
            .filter((q) => q.eq(q.field("published"), true))
            .order("asc")
            .take(n);

        return events;
    },
});

/**
 * Fetches all events for a given semester and year.
 *
 * @param {number} semester - The semester flag where `0` is spring and `1` is fall.
 * @param {number} year - The year to fetch events for.
 * @param {string | undefined} status - An unused optional status parameter.
 *
 * @returns {Array<Doc<"events"> & { hostingCompanyName: string }>} - All events in the semester with hosting company names.
 */
export const getAllEvents = internalQuery({
    args: {
        semester: v.number(),
        year: v.number(),
        status: v.optional(v.string()),
    },
    handler: async (ctx, { semester, year }) => {
        let range_start: Date;
        let range_end: Date;
        if (semester) {
            range_start = new Date(year, 7, 1);
            range_end = new Date(year, 11, 31);
        } else {
            range_start = new Date(year, 0, 1);
            range_end = new Date(year, 6, 30);
        }

        const events = await ctx.db
            .query("events")
            .withIndex("by_eventStart", (q) =>
                q.gte("eventStart", range_start.getTime()).lte("eventStart", range_end.getTime()),
            )
            .order("asc")
            .collect();

        const eventsWithCompany = await Promise.all(
            events.map(async (event) => {
                const company = await ctx.db.get(event.hostingCompany);
                return { ...event, hostingCompanyName: company?.name ?? "Ukjent" };
            }),
        );

        return eventsWithCompany;
    },
});

/**
 * Fetches published and unpublished events for a semester.
 *
 * @param {string} semester - The semester name.
 * @param {number} year - The year to fetch events for.
 *
 * @returns {{ published: Array<Doc<"events"> & { hostingCompanyName: string }>, unpublished: Array<Doc<"events"> & { hostingCompanyName: string }> }} - Events separated by publication status.
 */
export const getAll = query({
    args: {
        semester: v.string(),
        year: v.number(),
    },
    handler: async (ctx, { semester, year }) => {
        const semesterNumber = semester === "vår" ? 0 : 1; // 0 for spring, 1 for fall

        const events: Array<Doc<"events"> & { hostingCompanyName: string }> = await ctx.runQuery(
            internal.events.queries.getAllEvents,
            {
                semester: semesterNumber,
                year,
            },
        );

        const published = events.filter((event) => event.published);
        const unpublished = events.filter((event) => !event.published);
        return { published, unpublished };
    },
});

/**
 * Fetches the current semester's published events grouped by month.
 *
 * @param {boolean} isExternal - Whether to only include events with an external URL.
 *
 * @returns {Record<string, Array<Doc<"events"> & { hostingCompanyName: string, participationCount: number }>>} - Current semester events grouped by month name.
 */
export const getCurrentSemester = query({
    args: {
        isExternal: v.boolean(),
    },
    handler: async (ctx, { isExternal }) => {
        const semester = Date.now() < new Date().setMonth(7) ? 0 : 1; // 0 for spring, 1 for fall

        const events: Array<Doc<"events"> & { hostingCompanyName: string }> = (
            await ctx.runQuery(internal.events.queries.getAllEvents, {
                semester,
                year: new Date().getFullYear(),
            })
        ).filter((q) => q.published === true);

        const filteredEvents = isExternal
            ? events.filter((event) => event.externalUrl && event.externalUrl.length > 0)
            : events.filter((event) => event.externalUrl === undefined || event.externalUrl.length === 0);

        const eventsWithParticipationCount = await Promise.all(
            filteredEvents.map(async (event) => {
                const participationCount = (
                    await ctx.db
                        .query("registrations")
                        .withIndex("by_eventIdStatusAndRegistrationTime", (q) => q.eq("eventId", event._id))
                        .collect()
                ).filter((q) => q.status === "registered" || q.status === "pending").length;

                return { ...event, participationCount };
            }),
        );

        const monthNames = [
            "januar",
            "februar",
            "mars",
            "april",
            "mai",
            "juni",
            "juli",
            "august",
            "september",
            "oktober",
            "november",
            "desember",
        ];

        const eventsByMonth: Record<string, typeof eventsWithParticipationCount> = {};

        eventsWithParticipationCount.forEach((event) => {
            const eventDate = new Date(event.eventStart);
            const monthName = monthNames[eventDate.getMonth()] as string;

            if (!eventsByMonth[monthName]) {
                eventsByMonth[monthName] = [];
            }
            eventsByMonth[monthName].push(event);
        });

        return eventsByMonth;
    },
});

/**
 * Fetches an event by id or slug with hosting company and organizer data.
 *
 * @param {string} identifier - Either the event id or event slug.
 *
 * @throws - An error if the event or hosting company cannot be resolved.
 * @returns {Doc<"events"> & { hostingCompanyName: string, organizers: Awaited<ReturnType<typeof getOrganizers>> }} - The resolved event payload.
 */
export const getEvent = query({
    args: {
        identifier: v.string(),
    },
    handler: async (ctx, { identifier }) => {
        let event: Doc<"events"> | null = null;

        try {
            event = await ctx.db.get(identifier as Id<"events">);
        } catch { }

        if (!event) {
            event = await ctx.db
                .query("events")
                .withIndex("by_slug", (q) => q.eq("slug", identifier))
                .first();
        }

        if (!event) {
            throw new Error("Event not found");
        }

        const company = await ctx.db.get(event.hostingCompany);
        if (!company) throw new Error("Company not found");

        const organizers = await getOrganizers(ctx, event._id);

        return {
            ...event,
            hostingCompanyName: company?.name ?? "Ukjent",
            organizers,
        };
    },
});

/**
 * Resolves organizer records for an event into display data.
 *
 * @param {QueryCtx} ctx - The Convex query context.
 * @param {Id<"events">} eventId - The event id to fetch organizers for.
 *
 * @returns {Promise<Array<{ id: Id<"eventOrganizers">, name: string, role: ORGANIZER_ROLE, userId: Id<"users">, imageUrl: string, email: string }>>} - Organizer display data for the event.
 */
async function getOrganizers(ctx: QueryCtx, eventId: Id<"events">) {
    const organizers = await ctx.db
        .query("eventOrganizers")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect();

    const organizersWithName = await Promise.all(
        organizers.map(async (organizer) => {
            const user = await ctx.db.get(organizer.userId);
            if (!user)
                return {
                    id: organizer._id,
                    name: "Ukjent ansvarlig",
                    role: "medhjelper" as ORGANIZER_ROLE,
                    userId: organizer.userId,
                    imageUrl: "",
                    email: "",
                };

            return {
                id: organizer._id,
                name: `${user.firstName} ${user.lastName}`,
                role: organizer.role,
                userId: organizer.userId,
                imageUrl: user.image,
                email: user.email,
            };
        }),
    );

    return organizersWithName;
}

/**
 * Fetches all semester options covered by the stored events.
 *
 * @returns {Array<{ year: number, semester: string }>} - The available semesters.
 */
export const getPossibleSemesters = query({
    handler: async (ctx) => {
        const firstEvent = await ctx.db.query("events").withIndex("by_eventStart").order("asc").first();
        const lastEvent = await ctx.db.query("events").withIndex("by_eventStart").order("desc").first();

        if (!firstEvent || !lastEvent) {
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();

            return [{ year: currentYear, semester: currentMonth < 6 ? "vår" : "høst" }];
        }

        const firstYear = new Date(firstEvent.eventStart).getFullYear();
        const lastYear = new Date(lastEvent.eventStart).getFullYear();

        const possibleSemesters = [];
        for (let year = firstYear; year <= lastYear; year++) {
            possibleSemesters.push({ year, semester: "vår" }, { year, semester: "høst" });
        }

        return possibleSemesters;
    },
});

/**
 * Fetches organizers for an event by id.
 *
 * @param {Id<"events">} id - The id of the event to inspect.
 *
 * @returns {Array<Doc<"eventOrganizers"> & { name: string }>} - The organizers with resolved names.
 */
export const getOrganizersByEventId = query({
    args: {
        id: v.id("events"),
    },
    handler: async (ctx, { id }) => {
        const organizers = await ctx.db
            .query("eventOrganizers")
            .withIndex("by_eventId", (q) => q.eq("eventId", id))
            .collect();

        const organizersWithName = await Promise.all(
            organizers.map(async (organizer) => {
                const user = await ctx.db.get(organizer.userId);
                return {
                    ...organizer,
                    name: `${user?.firstName ?? "Ukjent"} ${user?.lastName ?? "Ansvarlig"}`,
                };
            }),
        );

        return organizersWithName;
    },
});
