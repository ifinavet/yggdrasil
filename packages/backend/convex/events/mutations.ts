import { BIFROST_LOCAL_URL, BIFROST_URL } from "@workspace/shared/constants";
import { EVENT_CHECKLIST } from "@workspace/shared/events/checklist";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { humanReadableFullDateTime } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { isLocalDevelopment } from "../auth/local";
import { syncFeedbackCampaign } from "../feedback/delivery/campaigns";
import { enqueueSystemMessage } from "../iam/notifications";
import { eventProductFields } from "../products/sales";
import { syncApplicationWithEvent } from "../semesterPlanning/events";
import { placeEventInPlan } from "../semesterPlanning/planEvents/helper";
import { requireFoodItem } from "./food";
import { eventSlug, insertEventWithOrganizers, setEventOrganizers } from "./helper";
import { makeStatusPending } from "./registrations/mutations";
import { editableEventFields, organizerRoleValidator } from "./schema";
import { queueEventNotification } from "./slack/state";

async function scheduleRegistrationOpenAlert(
	ctx: MutationCtx,
	event: {
		_id: Id<"events">;
		registrationOpens: number;
		eventStart: number;
		published: boolean;
		externalEvent: boolean;
	},
) {
	const now = Date.now();
	if (!event.published || event.externalEvent || event.eventStart <= now) {
		return;
	}

	const args = { eventId: event._id, registrationOpens: event.registrationOpens };
	if (event.registrationOpens <= now) {
		await ctx.scheduler.runAfter(0, internal.events.mutations.sendRegistrationOpenAlert, args);
	} else {
		await ctx.scheduler.runAt(
			event.registrationOpens,
			internal.events.mutations.sendRegistrationOpenAlert,
			args,
		);
	}
}

const eventMutationArgs = {
	...editableEventFields,
	foodItem: v.id("foodItems"),
	productId: v.optional(v.id("products")),
	organizers: v.array(
		v.object({
			userId: v.id("users"),
			role: organizerRoleValidator,
		}),
	),
};

/**
 * Updates an existing event and synchronizes its organizers and waitlist.
 *
 * @param {Id<"events">} id - The id of the event to update.
 * @param {string} title - The updated event title.
 * @param {string} teaser - The updated event teaser.
 * @param {string} description - The updated event description.
 * @param {number} eventStart - The event start time as a timestamp.
 * @param {number} registrationOpens - The registration opening time as a timestamp.
 * @param {number} participationLimit - The maximum number of participants.
 * @param {string} location - The event location.
 * @param {Id<"foodItems">} foodItem - The food served at the event.
 * @param {string} language - The event language.
 * @param {string} ageRestriction - The event age restriction.
 * @param {string | undefined} externalUrl - The optional external registration URL.
 * @param {Id<"companies">} hostingCompany - The hosting company id.
 * @param {boolean} published - Whether the event should be published.
 * @param {{ userId: Id<"users">, role: "hovedansvarlig" | "medhjelper" }[]} organizers - The organizer assignments.
 *
 * @throws - An error if the caller is unauthenticated or the event cannot be found.
 * @returns {null} - Returns null when the event is updated successfully.
 */
export const update = mutation({
	args: { id: v.id("events"), ...eventMutationArgs },
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
			foodItem,
			language,
			ageRestriction,
			externalEvent,
			externalUrl,
			hostingCompany,
			published,
			productId,
			organizers,
		},
	) => {
		const user = await requireRole(ctx, internalRoles);
		await requireFoodItem(ctx, foodItem);

		const event = await ctx.db.get(eventId);
		if (!event) {
			throw new ConvexError("Arrangementet ble ikke funnet.");
		}

		// Create a slug if it doesn't exist
		const slug = event.slug || eventSlug(title, eventStart);

		// Update the event details
		await ctx.db.patch(eventId, {
			title,
			teaser,
			description,
			eventStart,
			registrationOpens,
			participationLimit,
			location,
			foodItem,
			foodGuessed: undefined,
			language,
			ageRestriction,
			externalEvent,
			externalUrl,
			hostingCompany,
			published,
			slug,
			...(await eventProductFields(ctx, productId, event)),
		});
		if (event.registrationOpens !== registrationOpens || (!event.published && published)) {
			await scheduleRegistrationOpenAlert(ctx, {
				_id: eventId,
				registrationOpens,
				eventStart,
				published,
				externalEvent,
			});
		}

		await syncFeedbackCampaign(ctx, eventId);

		await setEventOrganizers(ctx, eventId, organizers);
		// A semester plan application follows its event: the same date and the same team.
		await syncApplicationWithEvent(ctx, eventId, { type: "internal", userId: user._id });
		// An event without an application follows its date into the right semester plan.
		const updated = await ctx.db.get(eventId);
		if (updated) await placeEventInPlan(ctx, updated, event.eventStart);

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

/**
 * Promotes waitlisted registrations into pending status.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Id<"events">} eventId - The id of the event to update.
 * @param {number} numOfNewPlaces - The number of new places to offer.
 *
 * @throws - An error if the event cannot be found.
 * @returns {Promise<void>} - Resolves when the waitlist has been updated.
 */
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
		throw new ConvexError(`Arrangementet med ID ${eventId} ble ikke funnet.`);
	}

	for (const registration of waitlistRegistrations.slice(0, numOfNewPlaces)) {
		await makeStatusPending(ctx, registration, event);
	}
};

/**
 * Updates the published status for multiple events.
 *
 * @param {Id<"events">[]} ids - The ids of the events to update.
 * @param {boolean} newPublishedStatus - The published status to assign.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {null} - Returns null when the events are updated successfully.
 */
export const updatePublishedStatus = mutation({
	args: {
		ids: v.array(v.id("events")),
		newPublishedStatus: v.boolean(),
	},
	handler: async (ctx, { ids, newPublishedStatus }) => {
		await requireRole(ctx, internalRoles);

		await Promise.all(
			ids.map(async (id) => {
				await ctx.db.patch(id, { published: newPublishedStatus });
				await syncFeedbackCampaign(ctx, id);
			}),
		);
	},
});

/**
 * Creates a new event and stores its organizer assignments.
 *
 * @param {string} title - The event title.
 * @param {string} teaser - The event teaser.
 * @param {string} description - The event description.
 * @param {number} eventStart - The event start time as a timestamp.
 * @param {number} registrationOpens - The registration opening time as a timestamp.
 * @param {number} participationLimit - The maximum number of participants.
 * @param {string} location - The event location.
 * @param {Id<"foodItems">} foodItem - The food served at the event.
 * @param {string} language - The event language.
 * @param {string} ageRestriction - The event age restriction.
 * @param {string | undefined} externalUrl - The optional external registration URL.
 * @param {Id<"companies">} hostingCompany - The hosting company id.
 * @param {boolean} published - Whether the event should be published.
 * @param {{ userId: Id<"users">, role: "hovedansvarlig" | "medhjelper" }[]} organizers - The organizer assignments.
 *
 * @throws - An error if the caller is unauthenticated.
 * @returns {null} - Returns null when the event is created successfully.
 */
export const create = mutation({
	args: eventMutationArgs,
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
			foodItem,
			language,
			ageRestriction,
			externalEvent,
			externalUrl,
			hostingCompany,
			published,
			productId,
			organizers,
		},
	) => {
		await requireRole(ctx, internalRoles);
		await requireFoodItem(ctx, foodItem);

		const eventId = await insertEventWithOrganizers(
			ctx,
			{
				title,
				teaser,
				description,
				eventStart,
				registrationOpens,
				participationLimit,
				location,
				foodItem,
				language,
				ageRestriction,
				externalEvent,
				externalUrl,
				hostingCompany,
				published,
				...(await eventProductFields(ctx, productId)),
			},
			organizers,
		);
		const created = await ctx.db.get(eventId);
		if (created) await placeEventInPlan(ctx, created);
		await scheduleRegistrationOpenAlert(ctx, {
			_id: eventId,
			registrationOpens,
			eventStart,
			published,
			externalEvent,
		});
	},
});

export const sendRegistrationOpenAlert = internalMutation({
	args: { eventId: v.id("events"), registrationOpens: v.number() },
	returns: v.null(),
	handler: async (ctx, { eventId, registrationOpens }) => {
		const event = await ctx.db.get(eventId);
		const now = Date.now();
		if (
			event &&
			event.registrationOpens === registrationOpens &&
			registrationOpens <= now &&
			event.eventStart > now &&
			event.published &&
			!event.externalEvent
		) {
			const previousNotice = await ctx.db
				.query("eventRegistrationOpenNotices")
				.withIndex("by_eventId_and_registrationOpens", (q) =>
					q.eq("eventId", eventId).eq("registrationOpens", registrationOpens),
				)
				.first();
			if (!previousNotice) {
				await ctx.db.insert("eventRegistrationOpenNotices", {
					eventId,
					registrationOpens,
					queuedAt: now,
				});
			}
			await queueEventNotification(
				ctx,
				eventId,
				`registration-open:${registrationOpens}`,
				"Påmeldingen er åpen! 🎉",
			);
			const origin = isLocalDevelopment() ? BIFROST_LOCAL_URL : BIFROST_URL;
			const title = event.title
				.replaceAll("&", "&amp;")
				.replaceAll("<", "&lt;")
				.replaceAll(">", "&gt;");
			await enqueueSystemMessage(ctx, {
				since: previousNotice?._creationTime ?? now,
				channel: SYSTEM_ALERTS_CHANNEL,
				clientMsgId: `registration-open-${eventId}-${registrationOpens}`,
				text: [
					"🔔 *Påmeldingen har åpnet*",
					`*Arrangement:* ${title}`,
					`*Tidspunkt:* ${humanReadableFullDateTime(new Date(registrationOpens))}`,
					`<${origin}/events/${eventId}|Åpne arrangementet>`,
				].join("\n"),
			});
		}
		return null;
	},
});

/** Catch up openings whose scheduled job was never created, including pre-existing events. */
export const catchUpRegistrationOpenAlerts = internalMutation({
	args: { cursor: v.optional(v.string()), now: v.optional(v.number()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = args.now ?? Date.now();
		const page = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (q) => q.gt("eventStart", now))
			.paginate({ cursor: args.cursor ?? null, numItems: 50 });
		const events = page.page.filter((event) => event.registrationOpens <= now);
		await Promise.all(
			events.map((event) =>
				ctx.runMutation(internal.events.mutations.sendRegistrationOpenAlert, {
					eventId: event._id,
					registrationOpens: event.registrationOpens,
				}),
			),
		);
		if (!page.isDone)
			await ctx.scheduler.runAfter(0, internal.events.mutations.catchUpRegistrationOpenAlerts, {
				cursor: page.continueCursor,
				now,
			});
		return null;
	},
});

export const setChecklistStep = mutation({
	args: { eventId: v.id("events"), stepId: v.string(), completed: v.boolean() },
	handler: async (ctx, { eventId, stepId, completed }) => {
		await requireRole(ctx, internalRoles);
		if (
			stepId === "description" ||
			!EVENT_CHECKLIST.some((phase) => phase.steps.some((step) => step.id === stepId))
		) {
			throw new ConvexError("Ukjent sjekklistepunkt.");
		}
		const event = await ctx.db.get(eventId);
		if (!event) throw new ConvexError("Arrangementet finnes ikke.");
		const steps = new Set(event.completedChecklistSteps ?? []);
		if (completed) steps.add(stepId);
		else steps.delete(stepId);
		await ctx.db.patch(eventId, { completedChecklistSteps: [...steps] });
	},
});
