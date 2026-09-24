import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { FEEDBACK_REPLY_TO } from "./messages";

export async function feedbackSignature(ctx: QueryCtx, eventId: Id<"events">) {
	const organizers = await ctx.db
		.query("eventOrganizers")
		.withIndex("by_eventId", (index) => index.eq("eventId", eventId))
		.take(20);
	const lead = organizers.find(({ role }) => role === "hovedansvarlig");
	const user = lead && (await ctx.db.get(lead.userId));
	if (user) return { name: `${user.firstName} ${user.lastName}`, email: user.email };
	return { name: "Navet", email: FEEDBACK_REPLY_TO };
}

export async function feedbackEmailContext(ctx: QueryCtx, event: Doc<"events">) {
	const company = await ctx.db.get(event.hostingCompany);
	if (!company) return null;
	return {
		title: event.title,
		companyName: company.name,
		signature: await feedbackSignature(ctx, event._id),
	};
}

export type FeedbackEmailContext = NonNullable<Awaited<ReturnType<typeof feedbackEmailContext>>>;
