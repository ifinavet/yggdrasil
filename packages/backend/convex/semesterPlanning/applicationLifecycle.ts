import { ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	type ApplicationStatus,
	canTransition,
	isActiveApplicationStatus,
	STATUS_LABELS,
} from "./rules";
import type { activityActor, applicationActivityType } from "./schema";

/** Who performed an activity. A Navet member is also recorded by user id. */
export type Actor =
	| { type: "internal"; userId: Id<"users"> }
	| { type: Exclude<Infer<typeof activityActor>, "internal"> };

type ActivityDetails = Pick<
	Doc<"companyApplicationActivity">,
	"fromStatus" | "toStatus" | "date" | "offerId" | "comment"
>;

/**
 * Appends a row to an application's history.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Id<"companyApplications">} applicationId - The application the entry belongs to.
 * @param {Infer<typeof applicationActivityType>} type - What happened.
 * @param {Actor} actor - Who did it.
 * @param {ActivityDetails} details - Optional status, date, offer and comment.
 *
 * @returns {Promise<Id<"companyApplicationActivity">>} - The id of the new history row.
 */
export async function logApplicationActivity(
	ctx: MutationCtx,
	applicationId: Id<"companyApplications">,
	type: Infer<typeof applicationActivityType>,
	actor: Actor,
	details: ActivityDetails = {},
): Promise<Id<"companyApplicationActivity">> {
	return ctx.db.insert("companyApplicationActivity", {
		applicationId,
		type,
		actor: actor.type,
		...(actor.type === "internal" ? { actorUserId: actor.userId } : {}),
		...details,
	});
}

/**
 * Changes an application's status and records the change in its history. This is the only code
 * that writes `status`, so the transition rules and the history cannot drift apart.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"companyApplications">} application - The application as read in this transaction.
 * @param {ApplicationStatus} to - The new status.
 * @param {Actor} actor - Who made the change.
 * @param {object} options - Extra fields to patch, and the offer or comment to log with the change.
 *
 * @throws - An error if the change is not allowed from the current status.
 * @returns {Promise<void>} - Resolves when the status and history are written.
 */
export async function transitionApplicationStatus(
	ctx: MutationCtx,
	application: Doc<"companyApplications">,
	to: ApplicationStatus,
	actor: Actor,
	options: {
		patch?: Partial<Omit<Doc<"companyApplications">, "_id" | "_creationTime" | "status">>;
		offerId?: Id<"companyApplicationOffers">;
		comment?: string;
	} = {},
): Promise<void> {
	const from = application.status;
	if (!canTransition(from, to)) {
		throw new ConvexError(`Kan ikke gå fra «${STATUS_LABELS[from]}» til «${STATUS_LABELS[to]}».`);
	}

	await ctx.db.patch(application._id, { ...options.patch, status: to });
	await logApplicationActivity(ctx, application._id, "status_changed", actor, {
		fromStatus: from,
		toStatus: to,
		...(options.offerId ? { offerId: options.offerId } : {}),
		...(options.comment ? { comment: options.comment } : {}),
	});
}

/**
 * Finds the live application that holds a date in a semester, if any.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"semesters">} semesterId - The semester to look in.
 * @param {string} date - The day, as YYYY-MM-DD.
 * @param {Id<"companyApplications">} [exceptId] - An application to ignore, usually the caller's own.
 *
 * @returns {Promise<Doc<"companyApplications"> | null>} - The application holding the date, or null.
 */
export async function findActiveApplicationOnDate(
	ctx: QueryCtx | MutationCtx,
	semesterId: Id<"semesters">,
	date: string,
	exceptId?: Id<"companyApplications">,
): Promise<Doc<"companyApplications"> | null> {
	const onDate = await ctx.db
		.query("companyApplications")
		.withIndex("by_semesterId_and_assignedDate", (q) =>
			q.eq("semesterId", semesterId).eq("assignedDate", date),
		)
		.collect();

	return (
		onDate.find(
			(application) =>
				application._id !== exceptId && isActiveApplicationStatus(application.status),
		) ?? null
	);
}

/**
 * Marks every pending offer on an application as superseded, so their links stop working.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Id<"companyApplications">} applicationId - The application whose offers to close.
 *
 * @returns {Promise<number>} - How many offers were superseded.
 */
export async function supersedePendingOffers(
	ctx: MutationCtx,
	applicationId: Id<"companyApplications">,
): Promise<number> {
	const offers = await ctx.db
		.query("companyApplicationOffers")
		.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
		.collect();

	const pending = offers.filter((offer) => offer.status === "pending");
	await Promise.all(pending.map((offer) => ctx.db.patch(offer._id, { status: "superseded" })));

	return pending.length;
}
