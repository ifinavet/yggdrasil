import { v } from "convex/values";
import { internalQuery, query } from "../../_generated/server";
import { getCurrentUser } from "../../auth/currentUser";
import {
	type FeedbackAccess,
	getFeedbackInviteAccess,
	getFeedbackTokenForm,
	getOwnFeedbackInviteForm,
} from "./access";

export const getTokenForm = internalQuery({
	args: { token: v.string(), now: v.number() },
	handler: getFeedbackTokenForm,
});

export const getOwnInviteForm = internalQuery({
	args: { inviteId: v.string(), now: v.number() },
	handler: getOwnFeedbackInviteForm,
});

export const myPendingFeedback = query({
	args: { now: v.number() },
	handler: async (ctx, { now }) => {
		const user = await getCurrentUser(ctx);
		if (!user) return null;
		const invites = await ctx.db
			.query("feedbackInvites")
			.withIndex("by_userId", (index) => index.eq("userId", user._id))
			.order("desc")
			.take(10);
		let latest: Extract<FeedbackAccess, { status: "open" }> | undefined;
		for (const invite of invites) {
			if (invite.responded) continue;
			const access = await getFeedbackInviteAccess(ctx, invite, now);
			if (access.status !== "open") continue;
			if (!latest || access.event.eventStart > latest.event.eventStart) latest = access;
		}
		if (!latest) return null;
		const company = await ctx.db.get(latest.event.hostingCompany);
		if (!company) return null;
		return {
			inviteId: latest.invite._id,
			companyName: company.name,
			firstName: user.firstName.trim(),
		};
	},
});
