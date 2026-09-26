import type { OrganizerRole } from "@workspace/shared/constants";
import { EVENT_SEMESTERS, eventSemesterOf, osloMonthName } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type QueryCtx, query } from "../_generated/server";
import {
	currentUserHasRole,
	getAccessRole,
	internalRoles,
	requireRole,
} from "../auth/accessRights";
import { eventFeedbackStatus } from "../feedback/eventStatus";
import { reportAccessAllowed } from "../feedback/reports/access";
import { countRegistrationsWithStatus, eventsInSemester, getEventByIdentifier } from "./helper";

const eventSemesterValidator = v.union(...EVENT_SEMESTERS.map((semester) => v.literal(semester)));

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
 * @param {EventSemester} semester - The semester, "vår" or "høst".
 * @param {number} year - The year to fetch events for.
 * @param {string | undefined} status - An unused optional status parameter.
 *
 * @returns {Array<Doc<"events"> & { hostingCompanyName: string }>} - All events in the semester with hosting company names.
 */
export const getAllEvents = internalQuery({
	args: {
		semester: eventSemesterValidator,
		year: v.number(),
		status: v.optional(v.string()),
	},
	handler: async (ctx, { semester, year }) => {
		const events = await eventsInSemester(ctx, semester, year);

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
 * Fetches every event in a semester with what the internal overview needs.
 *
 * @param {EventSemester} semester - The semester, "vår" or "høst".
 * @param {number} year - The year to fetch events for.
 *
 * @throws - An error if the caller does not have an internal role.
 *
 * @returns - The semester's events sorted by start, with company, organizers, registration counts and feedback status.
 */
export const getAll = query({
	args: {
		semester: eventSemesterValidator,
		year: v.number(),
	},
	handler: async (ctx, { semester, year }) => {
		const user = await requireRole(ctx, internalRoles);
		const accessRole = await getAccessRole(ctx, user._id);
		const events = await eventsInSemester(ctx, semester, year);

		const companies = new Map<Id<"companies">, ReturnType<typeof companyWithLogo>>();
		const companyOf = (companyId: Id<"companies">) => {
			const loaded = companies.get(companyId) ?? companyWithLogo(ctx, companyId);
			companies.set(companyId, loaded);
			return loaded;
		};

		return await Promise.all(
			events.map(async (event) => {
				const organizers = await getOrganizers(ctx, event._id);
				const myRoles = organizers
					.filter((organizer) => organizer.userId === user._id)
					.map((organizer) => organizer.role);
				const myRole: OrganizerRole | null = myRoles.includes("hovedansvarlig")
					? "hovedansvarlig"
					: (myRoles[0] ?? null);
				const [company, registered, pending, waitlist, feedbackStatus] = await Promise.all([
					companyOf(event.hostingCompany),
					countRegistrationsWithStatus(ctx, event._id, "registered"),
					countRegistrationsWithStatus(ctx, event._id, "pending"),
					countRegistrationsWithStatus(ctx, event._id, "waitlist"),
					eventFeedbackStatus(ctx, event._id, reportAccessAllowed(accessRole, myRole !== null)),
				]);

				return {
					_id: event._id,
					slug: event.slug,
					title: event.title,
					eventStart: event.eventStart,
					registrationOpens: event.registrationOpens,
					participationLimit: event.participationLimit,
					externalEvent: event.externalEvent,
					published: event.published,
					companyName: company.name,
					companyLogoUrl: company.logoUrl,
					leadName:
						organizers.find((organizer) => organizer.role === "hovedansvarlig")?.name ?? null,
					myRole,
					registeredCount: registered + pending,
					waitlistCount: waitlist,
					feedbackStatus,
				};
			}),
		);
	},
});

export async function companyWithLogo(ctx: QueryCtx, companyId: Id<"companies">) {
	const company = await ctx.db.get(companyId);
	if (!company) return { name: "Ukjent", logoUrl: null };
	const logo = await ctx.db.get(company.logo);
	return { name: company.name, logoUrl: logo ? await ctx.storage.getUrl(logo.image) : null };
}

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
		const events: Array<Doc<"events"> & { hostingCompanyName: string }> = (
			await ctx.runQuery(internal.events.queries.getAllEvents, eventSemesterOf(Date.now()))
		).filter((q) => q.published === true);

		const filteredEvents = events.filter((event) => {
			const externalEvent = event.externalEvent ?? Boolean(event.externalUrl?.length);
			return externalEvent === isExternal;
		});

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

		const eventsByMonth: Record<string, typeof eventsWithParticipationCount> = {};

		eventsWithParticipationCount.forEach((event) => {
			const monthName = osloMonthName(event.eventStart);

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
		const event = await getEventByIdentifier(ctx, identifier);

		if (!event.published && !(await currentUserHasRole(ctx, internalRoles))) {
			throw new ConvexError("Arrangementet ble ikke funnet.");
		}

		const company = await ctx.db.get(event.hostingCompany);
		if (!company) throw new ConvexError("Fant ikke bedriften som er vert for arrangementet.");

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
 * @returns {Promise<Array<{ id: Id<"eventOrganizers">, name: string, role: OrganizerRole, userId: Id<"users">, imageUrl: string, email: string }>>} - Organizer display data for the event.
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
					role: "medhjelper" as OrganizerRole,
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
 * @returns {Array<{ year: number, semester: EventSemester }>} - The available semesters.
 */
export const getPossibleSemesters = query({
	handler: async (ctx) => {
		const firstEvent = await ctx.db.query("events").withIndex("by_eventStart").order("asc").first();
		const lastEvent = await ctx.db.query("events").withIndex("by_eventStart").order("desc").first();

		if (!firstEvent || !lastEvent) {
			return [eventSemesterOf(Date.now())];
		}

		const firstYear = eventSemesterOf(firstEvent.eventStart).year;
		const lastYear = eventSemesterOf(lastEvent.eventStart).year;

		const possibleSemesters = [];
		for (let year = firstYear; year <= lastYear; year++) {
			possibleSemesters.push(...EVENT_SEMESTERS.map((semester) => ({ year, semester })));
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
		const event = await ctx.db.get(id);
		if (!event) {
			throw new ConvexError("Arrangementet ble ikke funnet.");
		}

		if (!event.published && !(await currentUserHasRole(ctx, internalRoles))) {
			throw new ConvexError("Arrangementet ble ikke funnet.");
		}

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
