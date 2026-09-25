import type { OrganizerRole } from "@workspace/shared/constants";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { getAccessRole, internalRoles, requireRole } from "../auth/accessRights";
import { latestCampaign } from "../feedback/delivery/campaigns";
import { isReportFeatureEnabled } from "../feedback/reports/access";
import { eventsInSemester } from "./helper";

export type FeedbackStatus = "draft" | "delivered" | "open" | "scheduled";

type Company = { name: string; logoUrl: string | null };

async function loadCompany(ctx: QueryCtx, companyId: Id<"companies">): Promise<Company> {
	const company = await ctx.db.get(companyId);
	if (!company) return { name: "Ukjent", logoUrl: null };
	const logo = await ctx.db.get(company.logo);
	return { name: company.name, logoUrl: logo ? await ctx.storage.getUrl(logo.image) : null };
}

async function countByStatus(
	ctx: QueryCtx,
	eventId: Id<"events">,
	status: Doc<"registrations">["status"],
) {
	const registrations = await ctx.db
		.query("registrations")
		.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
			q.eq("eventId", eventId).eq("status", status),
		)
		.collect();
	return registrations.length;
}

async function feedbackStatus(
	ctx: QueryCtx,
	eventId: Id<"events">,
	canSeeReport: boolean,
): Promise<FeedbackStatus | null> {
	const campaign = await latestCampaign(ctx, eventId);
	if (!campaign) return null;
	if (canSeeReport && isReportFeatureEnabled()) {
		const report = await ctx.db
			.query("feedbackReports")
			.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
			.unique();
		if (report?.status === "draft") return "draft";
		if (report?.status === "approved" && report.deliveryStatus === "delivered") return "delivered";
	}
	if (campaign.status === "open" || campaign.status === "scheduled") return campaign.status;
	return null;
}

export const getOverview = query({
	args: {
		semester: v.string(),
		year: v.number(),
	},
	handler: async (ctx, { semester, year }) => {
		const user = await requireRole(ctx, internalRoles);
		const isSuperAdmin = (await getAccessRole(ctx, user._id)) === "super-admin";
		const events = await eventsInSemester(ctx, semester === "vår" ? 0 : 1, year);

		const companies = new Map<Id<"companies">, Promise<Company>>();
		const companyOf = (companyId: Id<"companies">) => {
			const cached = companies.get(companyId);
			if (cached) return cached;
			const loaded = loadCompany(ctx, companyId);
			companies.set(companyId, loaded);
			return loaded;
		};

		return await Promise.all(
			events.map(async (event) => {
				const organizers = await ctx.db
					.query("eventOrganizers")
					.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
					.collect();
				const lead = organizers.find((organizer) => organizer.role === "hovedansvarlig");
				const leadUser = lead ? await ctx.db.get(lead.userId) : null;
				const myRoles = organizers
					.filter((organizer) => organizer.userId === user._id)
					.map((organizer) => organizer.role);
				const myRole: OrganizerRole | null = myRoles.includes("hovedansvarlig")
					? "hovedansvarlig"
					: (myRoles[0] ?? null);
				const company = await companyOf(event.hostingCompany);
				const [registered, pending, waitlist, feedback] = await Promise.all([
					countByStatus(ctx, event._id, "registered"),
					countByStatus(ctx, event._id, "pending"),
					countByStatus(ctx, event._id, "waitlist"),
					feedbackStatus(ctx, event._id, isSuperAdmin || myRole !== null),
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
					leadName: leadUser ? `${leadUser.firstName} ${leadUser.lastName}` : null,
					myRole,
					registeredCount: registered + pending,
					waitlistCount: waitlist,
					feedbackStatus: feedback,
				};
			}),
		);
	},
});
