import { v } from "convex/values";
import { query } from "../../_generated/server";
import { isActiveApplicationStatus } from "../rules";
import { presentationEventType, venue } from "../schema";
import { listSemesterDates, requireSemester } from "../semesters/helper";
import { findOfferByToken } from "./helper";

/**
 * The offer page on Hugin. Public: the link token is the only credential. It returns the offered
 * date and event, the terms and the state of the offer, and never contact or invoice details.
 * While the offer is open it also lists the semester's open dates, for «be om en annen dato»,
 * without saying which ones other companies have.
 *
 * @param {string} token - The token from the offer link.
 *
 * @returns {object} - `{ state: "unknown" }`, or the offer and its state.
 */
export const getByToken = query({
	args: { token: v.string() },
	returns: v.union(
		v.object({ state: v.literal("unknown") }),
		v.object({
			state: v.union(
				v.literal("pending"),
				v.literal("accepted"),
				v.literal("new_date_requested"),
				v.literal("declined"),
				v.literal("superseded"),
				v.literal("inactive"),
			),
			companyName: v.string(),
			date: v.string(),
			eventType: presentationEventType,
			maxStudents: v.number(),
			venue,
			termsUrl: v.optional(v.string()),
			respondedAt: v.optional(v.number()),
			requestedDates: v.optional(v.array(v.string())),
			openDates: v.optional(v.array(v.string())),
		}),
	),
	handler: async (ctx, { token }) => {
		const offer = await findOfferByToken(ctx, token);
		const application = offer ? await ctx.db.get(offer.applicationId) : null;
		if (!offer || !application) return { state: "unknown" as const };

		const semester = await requireSemester(ctx, application.semesterId);
		// A declined offer closes the application, but the company should see that it declined. An
		// accepted offer only counts while the application is still confirmed on it.
		const current =
			offer.status === "accepted"
				? application.status === "confirmed"
				: isActiveApplicationStatus(application.status);
		const state = offer.status === "declined" || current ? offer.status : ("inactive" as const);
		const openDates =
			state === "pending"
				? (await listSemesterDates(ctx, application.semesterId))
						.filter((date) => date.closedLabel === undefined && date.date !== offer.date)
						.map((date) => date.date)
				: undefined;

		return {
			state,
			companyName: application.registry.name,
			date: offer.date,
			eventType: offer.eventType,
			maxStudents: offer.maxStudents,
			venue: application.venue,
			...(semester.termsUrl ? { termsUrl: semester.termsUrl } : {}),
			...(offer.respondedAt ? { respondedAt: offer.respondedAt } : {}),
			...(offer.requestedDates ? { requestedDates: offer.requestedDates } : {}),
			...(openDates ? { openDates } : {}),
		};
	},
});
