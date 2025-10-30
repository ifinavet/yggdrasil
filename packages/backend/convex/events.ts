import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { makeStatusPending } from "./registration";
import { getCurrentUserOrThrow } from "./users";

// Shared validator for organizer roles
const organizerRoleValidator = v.union(
	v.literal("hovedansvarlig"),
	v.literal("medhjelper"),
);
type OrganizerRole = "hovedansvarlig" | "medhjelper";

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
			.withIndex("by_eventStart", (q) =>
				q.gte("eventStart", firstDayOfThisWeek.getTime()),
			)
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

export const getAllEvents = internalQuery({
	args: {
		semester: v.number(),
		year: v.number(),
		status: v.optional(v.string()),
	},
	handler: async (ctx, { semester, year }) => {
		let range_start: Date;
		let range_end: Date;
		if (!semester) {
			range_start = new Date(year, 0, 1);
			range_end = new Date(year, 6, 30);
		} else {
			range_start = new Date(year, 7, 1);
			range_end = new Date(year, 11, 31);
		}

		const events = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (q) =>
				q
					.gte("eventStart", range_start.getTime())
					.lte("eventStart", range_end.getTime()),
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

export const getAll = query({
	args: {
		semester: v.string(),
		year: v.number(),
	},
	handler: async (ctx, { semester, year }) => {
		const semesterNumber = semester === "vår" ? 0 : 1; // 0 for spring, 1 for fall

		const events: Array<Doc<"events"> & { hostingCompanyName: string }> =
			await ctx.runQuery(internal.events.getAllEvents, {
				semester: semesterNumber,
				year,
			});

		const published = events.filter((event) => event.published);
		const unpublished = events.filter((event) => !event.published);
		return { published, unpublished };
	},
});

export const getCurrentSemester = query({
	args: {
		isExternal: v.boolean(),
	},
	handler: async (ctx, { isExternal }) => {
		const semester = Date.now() < new Date().setMonth(7) ? 0 : 1; // 0 for spring, 1 for fall

		const events: Array<Doc<"events"> & { hostingCompanyName: string }> = (
			await ctx.runQuery(internal.events.getAllEvents, {
				semester,
				year: new Date().getFullYear(),
			})
		).filter((q) => q.published === true);

		const filteredEvents = isExternal
			? events.filter(
					(event) => event.externalUrl && event.externalUrl.length > 0,
				)
			: events.filter(
					(event) =>
						event.externalUrl === undefined || event.externalUrl.length === 0,
				);

		const eventsWithParticipationCount = await Promise.all(
			filteredEvents.map(async (event) => {
				const participationCount = (
					await ctx.db
						.query("registrations")
						.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
							q.eq("eventId", event._id),
						)
						.collect()
				).filter(
					(q) => q.status === "registered" || q.status === "pending",
				).length;

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

		const eventsByMonth: Record<string, typeof eventsWithParticipationCount> =
			{};

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

export const getEvent = query({
	args: {
		identifier: v.string(),
	},
	handler: async (ctx, { identifier }) => {
		let event: Doc<"events"> | null = null;

		try {
			event = await ctx.db.get(identifier as Id<"events">);
		} catch {}

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

export const getPossibleSemesters = query({
	handler: async (ctx) => {
		const firstEvent = await ctx.db
			.query("events")
			.withIndex("by_eventStart")
			.order("asc")
			.first();
		const lastEvent = await ctx.db
			.query("events")
			.withIndex("by_eventStart")
			.order("desc")
			.first();

		if (!firstEvent || !lastEvent) {
			const today = new Date();
			const currentYear = today.getFullYear();
			const currentMonth = today.getMonth();

			return [
				{ year: currentYear, semester: currentMonth < 6 ? "vår" : "høst" },
			];
		}

		const firstYear = new Date(firstEvent.eventStart).getFullYear();
		const lastYear = new Date(lastEvent.eventStart).getFullYear();

		const possibleSemesters = [];
		for (let year = firstYear; year <= lastYear; year++) {
			possibleSemesters.push(
				{ year, semester: "vår" },
				{ year, semester: "høst" },
			);
		}

		return possibleSemesters;
	},
});

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

		// Update the event details
		await ctx.db.replaceAll(eventId, {
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
		});

		await ctx.runMutation(internal.events.upsertEventOrganizer, {
			id: eventId,
			updatedOrganizers: organizers,
		});

		const registeredCount = (
			await ctx.db
				.query("registrations")
				.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
					q.eq("eventId", eventId).eq("status", "registered"),
				)
				.collect()
		).length;

		const pendingCount = (
			await ctx.db
				.query("registrations")
				.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
					q.eq("eventId", eventId).eq("status", "pending"),
				)
				.collect()
		).length;

		if (
			participationLimit - event.participationLimit > 0 &&
			registeredCount + pendingCount === event.participationLimit
		)
			await updateWaitlist(
				ctx,
				event._id,
				participationLimit - event.participationLimit,
			);
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
			.filter(
				(org) => !updatedOrganizers.some(({ userId }) => userId === org.userId),
			)
			.map((org) => ctx.db.delete(org._id));

		const organizersToAdd = updatedOrganizers
			.filter(
				({ userId }) => !eventOrganizers.some((org) => org.userId === userId),
			)
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
				const existing = eventOrganizers.find(
					(eOrg) => eOrg.userId === org.userId,
				);
				if (existing) {
					ctx.db.patch(existing._id, { role: org.role });
				}
			});

		await Promise.all([
			...organizersToRemove,
			...organizersToAdd,
			...organizersToUpdate,
		]);
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
			.map(
				async (registration) =>
					await makeStatusPending(ctx, registration, event),
			),
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
	const hash = Math.abs(
		str.split("").reduce((a, b) => (a << 5) - a + (b.codePointAt(0) || 0), 0),
	);
	const result = hash.toString(36).toUpperCase();
	return result.length < 4
		? result.padStart(4, "0").substring(0, 4)
		: result.substring(0, 4);
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
