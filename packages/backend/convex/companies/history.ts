import { STATUS_LABELS } from "@workspace/shared/semester/labels";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";

const LIMIT = 50;
const changeFieldLabels = {
	displayName: "Navn",
	description: "beskrivelse",
	logo: "logo",
	billing: "fakturainfo",
} as const;

export const getHistory = query({
	args: { companyId: v.id("companies") },
	handler: async (ctx, { companyId }) => {
		await requireRole(ctx, internalRoles);
		const company = await ctx.db.get(companyId);
		if (!company) return [];

		const [events, applications, orders, ...requestsByStatus] = await Promise.all([
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

		const timeline: {
			id: string;
			at: number;
			label: string;
			detail?: string;
			href?: string;
			dateLabel?: string;
		}[] = [{ id: `company-${companyId}`, at: company._creationTime, label: "Bedrift registrert" }];

		await Promise.all(
			applications.map(async (application) => {
				const semester = await ctx.db.get(application.semesterId);
				const label = semester
					? `Søknad, ${semester.term === "spring" ? "vår" : "høst"} ${semester.year}`
					: "Søknad";
				const activities = await ctx.db
					.query("companyApplicationActivity")
					.withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
					.order("desc")
					.take(LIMIT);
				for (const activity of activities) {
					const statusChange =
						activity.type === "status_changed" && activity.toStatus
							? `${activity.fromStatus ? `${STATUS_LABELS[activity.fromStatus]} → ` : ""}${STATUS_LABELS[activity.toStatus]}`
							: undefined;
					const activityLabel =
						activity.type === "submitted"
							? "Søknad sendt"
							: activity.type === "status_changed"
								? "Søknadsstatus endret"
								: activity.type === "date_assigned"
									? "Dato tildelt"
									: activity.type === "date_cleared"
										? "Tildelt dato fjernet"
										: "Arrangement knyttet til søknaden";
					timeline.push({
						id: `application-${activity._id}`,
						at: activity._creationTime,
						label: `${label}: ${activityLabel}`,
						detail: statusChange ?? activity.date,
						href: `/semesterplan/soknad/${application._id}`,
						dateLabel: "Loggført",
					});
				}
			}),
		);

		for (const event of events) {
			timeline.push({
				id: `event-${event._id}`,
				at: event.eventStart,
				label: `Arrangement: ${event.title}`,
				detail: event.published ? "Publisert" : "Utkast",
				href: event.slug ? `/events/${event.slug}` : undefined,
				dateLabel: "Arrangementsdato",
			});

			const [campaign] = await ctx.db
				.query("feedbackCampaigns")
				.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
				.order("desc")
				.take(1);
			if (!campaign) continue;
			const [report] = await ctx.db
				.query("feedbackReports")
				.withIndex("by_campaignId", (q) => q.eq("campaignId", campaign._id))
				.take(1);
			if (report?.status === "approved" && report.approvedAt) {
				timeline.push({
					id: `report-${report._id}`,
					at: report.approvedAt,
					label: `Tilbakemeldingsrapport godkjent: ${event.title}`,
					href: event.slug ? `/events/${event.slug}/report` : undefined,
					dateLabel: "Godkjent",
				});
			}
		}

		for (const order of orders) {
			const status = {
				awaiting_email: "Venter på e-postbekreftelse",
				confirmed: "Bekreftet",
				published: "Publisert",
				rejected: "Avslått",
			}[order.status];
			timeline.push({
				id: `order-${order._id}`,
				at: order.decidedAt ?? order.confirmedAt ?? order._creationTime,
				label: `Bestilling ${order.reference}: ${order.productName}`,
				detail: status,
				dateLabel: order.decidedAt ? "Avgjort" : order.confirmedAt ? "Bekreftet" : "Registrert",
			});
		}

		for (const requests of requestsByStatus) {
			for (const request of requests) {
				const label = {
					pending: "Endring av bedriftsprofil sendt inn",
					approved: "Endring av bedriftsprofil godkjent",
					rejected: "Endring av bedriftsprofil avslått",
				}[request.status];
				const changedFields = Object.keys(request.changes)
					.map((field) => changeFieldLabels[field as keyof typeof changeFieldLabels])
					.join(", ");
				timeline.push({
					id: `request-${request._id}`,
					at: request.decidedAt ?? request._creationTime,
					label,
					detail: changedFields || undefined,
					dateLabel: request.decidedAt ? "Avgjort" : "Sendt inn",
				});
			}
		}

		return timeline.sort((a, b) => b.at - a.at).slice(0, 200);
	},
});
