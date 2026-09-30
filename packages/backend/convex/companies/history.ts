import { STATUS_LABELS } from "@workspace/shared/semester/labels";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";

const LIMIT = 50;
const changeFieldLabels = {
	displayName: "Navn",
	description: "beskrivelse",
	logo: "logo",
	billing: "fakturainfo",
} as const;
const activityLabels: Record<Doc<"companyApplicationActivity">["type"], string> = {
	submitted: "Søknad sendt",
	status_changed: "Søknadsstatus endret",
	date_assigned: "Dato tildelt",
	date_cleared: "Tildelt dato fjernet",
	event_linked: "Arrangement knyttet til søknaden",
};
const orderStatusLabels = {
	awaiting_email: "Venter på e-postbekreftelse",
	confirmed: "Bekreftet",
	published: "Publisert",
	rejected: "Avslått",
};
const requestStatusLabels = {
	pending: "Endring av bedriftsprofil sendt inn",
	approved: "Endring av bedriftsprofil godkjent",
	rejected: "Endring av bedriftsprofil avslått",
};

type TimelineItem = {
	id: string;
	at: number;
	label: string;
	detail?: string;
	href?: string;
	dateLabel?: string;
};

function applicationName(semester: Doc<"semesters"> | null) {
	if (!semester) return "Søknad";
	const term = semester.term === "spring" ? "vår" : "høst";
	return `Søknad, ${term} ${semester.year}`;
}

function applicationActivityDetail(activity: Doc<"companyApplicationActivity">) {
	if (activity.type !== "status_changed" || !activity.toStatus) return activity.date;
	const previous = activity.fromStatus ? `${STATUS_LABELS[activity.fromStatus]} → ` : "";
	return `${previous}${STATUS_LABELS[activity.toStatus]}`;
}

async function applicationHistory(
	ctx: QueryCtx,
	applications: Doc<"companyApplications">[],
): Promise<TimelineItem[]> {
	const histories = await Promise.all(
		applications.map(async (application) => {
			const semester = await ctx.db.get(application.semesterId);
			const name = applicationName(semester);
			const activities = await ctx.db
				.query("companyApplicationActivity")
				.withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
				.order("desc")
				.take(LIMIT);
			return activities.map((activity) => ({
				id: `application-${activity._id}`,
				at: activity._creationTime,
				label: `${name}: ${activityLabels[activity.type]}`,
				detail: applicationActivityDetail(activity),
				href: `/semesterplan/soknad/${application._id}`,
				dateLabel: "Loggført",
			}));
		}),
	);
	return histories.flat();
}

async function eventHistory(ctx: QueryCtx, events: Doc<"events">[]): Promise<TimelineItem[]> {
	const histories = await Promise.all(
		events.map(async (event) => {
			const entries: TimelineItem[] = [
				{
					id: `event-${event._id}`,
					at: event.eventStart,
					label: `Arrangement: ${event.title}`,
					detail: event.published ? "Publisert" : "Utkast",
					href: event.slug ? `/events/${event.slug}` : undefined,
					dateLabel: "Arrangementsdato",
				},
			];
			const [campaign] = await ctx.db
				.query("feedbackCampaigns")
				.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
				.order("desc")
				.take(1);
			if (!campaign) return entries;

			const [report] = await ctx.db
				.query("feedbackReports")
				.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
				.take(1);
			if (report?.status !== "approved" || !report.approvedAt) return entries;
			entries.push({
				id: `report-${report._id}`,
				at: report.approvedAt,
				label: `Tilbakemeldingsrapport godkjent: ${event.title}`,
				href: event.slug ? `/events/${event.slug}/report` : undefined,
				dateLabel: "Godkjent",
			});
			return entries;
		}),
	);
	return histories.flat();
}

function orderDateLabel(order: Doc<"jobListingOrders">) {
	if (order.decidedAt) return "Avgjort";
	if (order.confirmedAt) return "Bekreftet";
	return "Registrert";
}

function orderHistory(orders: Doc<"jobListingOrders">[]): TimelineItem[] {
	return orders.map((order) => ({
		id: `order-${order._id}`,
		at: order.decidedAt ?? order.confirmedAt ?? order._creationTime,
		label: `Annonsekjøp ${order.reference}: ${order.productName}`,
		detail: `${orderStatusLabels[order.status]} · ${order.quantity} ${order.quantity === 1 ? "annonse" : "annonser"}`,
		dateLabel: orderDateLabel(order),
	}));
}

async function listingHistory(
	ctx: QueryCtx,
	listings: Doc<"jobListings">[],
	visibleOrderIds: ReadonlySet<Id<"jobListingOrders">>,
): Promise<TimelineItem[]> {
	const entries = await Promise.all(
		listings.map(async (listing): Promise<TimelineItem[]> => {
			const item = await ctx.db
				.query("jobListingOrderItems")
				.withIndex("by_jobListingId", (q) => q.eq("jobListingId", listing._id))
				.first();
			// Keep the listing when its order is outside the history window or no longer exists.
			if (item && visibleOrderIds.has(item.orderId)) return [];
			return [
				{
					id: `listing-${listing._id}`,
					at: listing.publishedAt ?? listing._creationTime,
					label: `Stillingsannonse: ${listing.title}`,
					detail: listing.published ? "Publisert" : "Ikke publisert",
					href: `/job-listings/${listing._id}`,
					dateLabel: listing.publishedAt === undefined ? "Opprettet" : "Publisert",
				},
			];
		}),
	);
	return entries.flat();
}

function requestHistory(requests: Doc<"companyUpdateRequests">[]): TimelineItem[] {
	return requests.map((request) => ({
		id: `request-${request._id}`,
		at: request.decidedAt ?? request._creationTime,
		label: requestStatusLabels[request.status],
		detail: Object.keys(request.changes)
			.map((field) => changeFieldLabels[field as keyof typeof changeFieldLabels])
			.join(", "),
		dateLabel: request.decidedAt ? "Avgjort" : "Sendt inn",
	}));
}

export const getHistory = query({
	args: { companyId: v.id("companies") },
	handler: async (ctx, { companyId }) => {
		await requireRole(ctx, internalRoles);
		const company = await ctx.db.get(companyId);
		if (!company) return [];

		const [events, applications, orders, listings, ...requestsByStatus] = await Promise.all([
			ctx.db
				.query("events")
				.withIndex("by_hostingCompany_and_eventStart", (q) => q.eq("hostingCompany", companyId))
				.order("desc")
				.take(LIMIT),
			ctx.db
				.query("companyApplications")
				.withIndex("by_orgNumber", (q) => q.eq("orgNumber", String(company.orgNumber)))
				.order("desc")
				.take(LIMIT),
			ctx.db
				.query("jobListingOrders")
				.withIndex("by_companyId", (q) => q.eq("companyId", companyId))
				.order("desc")
				.take(LIMIT),
			ctx.db
				.query("jobListings")
				.withIndex("by_company", (q) => q.eq("company", companyId))
				.order("desc")
				.take(LIMIT),
			...(["pending", "approved", "rejected"] as const).map((status) =>
				ctx.db
					.query("companyUpdateRequests")
					.withIndex("by_companyId_and_status", (q) =>
						q.eq("companyId", companyId).eq("status", status),
					)
					.order("desc")
					.take(LIMIT),
			),
		]);

		const requests = requestsByStatus.flat();
		const timeline: TimelineItem[] = [
			{ id: `company-${companyId}`, at: company._creationTime, label: "Bedrift registrert" },
			...(await applicationHistory(ctx, applications)),
			...(await eventHistory(ctx, events)),
			...orderHistory(orders),
			...(await listingHistory(ctx, listings, new Set(orders.map((order) => order._id)))),
			...requestHistory(requests),
		];
		timeline.sort((a, b) => b.at - a.at);
		return timeline.slice(0, 200);
	},
});
