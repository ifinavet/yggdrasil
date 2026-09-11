import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

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
		throw new Error("Event not found");
	}

	return event;
}

export function validateRegistrationTime(event: Doc<"events">) {
	const now = Date.now();
	if (now < event.registrationOpens) {
		throw new Error(`Påmelding til arrangementet "${event.title}" har ikke åpnet ennå.`);
	}
	if (now >= event.eventStart) {
		throw new Error(`Påmelding til arrangementet "${event.title}" er stengt.`);
	}
}

export async function validateUserCanRegister(ctx: MutationCtx, user: Doc<"users">) {
	if (user.locked) {
		throw new Error("Kontoen din er låst fra å melde seg på arrangementer.");
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
			throw new Error("Du har 3 eller flere prikker og kan ikke melde deg på arrangementer.");
		}
	}
}

export async function isEventOrganizerOrAdmin(
	ctx: QueryCtx | MutationCtx,
	eventId: Id<"events">,
	userId: Id<"users">,
): Promise<boolean> {
	const access = await ctx.db
		.query("accessRights")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.first();

	if (access && ["super-admin", "admin", "editor", "internal"].includes(access.role)) {
		return true;
	}

	const organizer = await ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.filter((q) => q.eq(q.field("userId"), userId))
		.first();

	return organizer !== null;
}
