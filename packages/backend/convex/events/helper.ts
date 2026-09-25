import type { OrganizerRole } from "@workspace/shared/constants";
import { osloToday, termOfDay } from "@workspace/shared/semester/time";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalRoles, userHasRole } from "../auth/accessRights";

export async function getEventByIdentifier(
	ctx: QueryCtx,
	identifier: string,
): Promise<Doc<"events">> {
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
		throw new ConvexError("Arrangementet ble ikke funnet.");
	}

	return event;
}

export function validateRegistrationTime(event: Doc<"events">) {
	const now = Date.now();
	if (now < event.registrationOpens) {
		throw new ConvexError(`Påmelding til arrangementet "${event.title}" har ikke åpnet ennå.`);
	}
	if (now >= event.eventStart) {
		throw new ConvexError(`Påmelding til arrangementet "${event.title}" er stengt.`);
	}
}

export async function validateUserCanRegister(ctx: MutationCtx, user: Doc<"users">) {
	if (user.locked) {
		throw new ConvexError("Kontoen din er låst fra å melde seg på arrangementer.");
	}

	const student = await ctx.db
		.query("students")
		.withIndex("by_userId", (q) => q.eq("userId", user._id))
		.first();

	if (student) {
		const points = await ctx.db
			.query("points")
			.withIndex("by_studentId", (q) => q.eq("studentId", student._id))
			.collect();
		const totalPoints = points.reduce((acc, p) => acc + p.severity, 0);
		if (totalPoints >= 3) {
			throw new ConvexError("Du har 3 eller flere prikker og kan ikke melde deg på arrangementer.");
		}
	}
}

export async function isEventOrganizerOrAdmin(
	ctx: QueryCtx | MutationCtx,
	eventId: Id<"events">,
	userId: Id<"users">,
): Promise<boolean> {
	if (await userHasRole(ctx, userId, internalRoles)) {
		return true;
	}

	const organizer = await ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.filter((q) => q.eq(q.field("userId"), userId))
		.first();

	return organizer !== null;
}

export type NewEvent = Omit<Doc<"events">, "_id" | "_creationTime" | "slug" | "formId">;

// Not meant for security purposes
/**
 * Creates a short deterministic hash from a string.
 *
 * @param {string} str - The input string to hash.
 *
 * @returns {string} - A four-character uppercase hash.
 */
function simpleHash(str: string): string {
	const hash = Math.abs(str.split("").reduce((a, b) => (a << 5) - a + (b.codePointAt(0) || 0), 0));
	const result = hash.toString(36).toUpperCase();
	return result.length < 4 ? result.padStart(4, "0").substring(0, 4) : result.substring(0, 4);
}

/**
 * Creates the event slug from its title and start, prefixed with its term, e.g. "v27-" or "h26-".
 *
 * @param {string} title - The event title.
 * @param {number} eventStart - When the event starts, in epoch milliseconds.
 *
 * @returns {string} - The generated slug.
 */
export function eventSlug(title: string, eventStart: number): string {
	let slugTitle = title
		.normalize("NFD")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-");

	if (slugTitle.length === 0) slugTitle = simpleHash(title).toLowerCase();

	const { year, term } = termOfDay(osloToday(eventStart));
	const termPrefix = term === "autumn" ? "h" : "v";

	return `${termPrefix}${String(year).slice(2)}-${slugTitle}-${simpleHash(title)}`;
}

/**
 * Creates an event with its feedback form, slug and organizers. Shared by events.create and by
 * creating an event from a semester planning application.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {NewEvent} event - The event fields.
 * @param {{ userId: Id<"users">, role: "hovedansvarlig" | "medhjelper" }[]} organizers - The organizers.
 *
 * @returns {Promise<Id<"events">>} - The id of the new event.
 */
export async function insertEventWithOrganizers(
	ctx: MutationCtx,
	event: NewEvent,
	organizers: { userId: Id<"users">; role: OrganizerRole }[],
): Promise<Id<"events">> {
	// Creating the feedback form for after the event
	const formId = await ctx.runMutation(internal.forms.mutations.createEventFeedbackForm);
	if (!formId) {
		console.error("Failed to create feedback form");
	}

	const eventId = await ctx.db.insert("events", {
		...event,
		slug: eventSlug(event.title, event.eventStart),
		formId,
	});

	await Promise.all(
		organizers.map(({ userId, role }) =>
			ctx.db.insert("eventOrganizers", { eventId, userId, role }),
		),
	);

	return eventId;
}

export async function eventsInSemester(ctx: QueryCtx, semester: number, year: number) {
	const rangeStart = semester ? new Date(year, 7, 1) : new Date(year, 0, 1);
	const rangeEnd = semester ? new Date(year, 11, 31) : new Date(year, 6, 30);

	return await ctx.db
		.query("events")
		.withIndex("by_eventStart", (q) =>
			q.gte("eventStart", rangeStart.getTime()).lte("eventStart", rangeEnd.getTime()),
		)
		.order("asc")
		.collect();
}
