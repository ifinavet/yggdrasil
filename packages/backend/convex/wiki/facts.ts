import { ATTENDANCE_POINTS, POINT_LOCKOUT_THRESHOLD } from "@workspace/shared/events/attendance";
import { EVENT_CHECKLIST } from "@workspace/shared/events/checklist";
import { formatNokFromOre } from "@workspace/shared/products";
import {
	DAY_MS,
	EVENT_PLANNING,
	FEEDBACK_CLOSE_DAYS,
	FEEDBACK_OPEN_TIME,
	FEEDBACK_RETENTION_MONTHS,
	REMINDER_DAYS,
} from "@workspace/shared/time";
import { WIKI_FACT_KEYS, WIKI_FACTS } from "@workspace/shared/wiki";
import { query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { getLatestPublishedVersion } from "../feedback/forms/helpers";
import { oneOf } from "../lib/validators";
import { POINT_LIFETIME_MS } from "../points/lifetime";

type FactPanel = {
	title: string;
	rows: { label: string; value: string }[];
	note?: string;
};
export const get = query({
	args: { key: oneOf(WIKI_FACT_KEYS) },
	handler: async (ctx, { key }): Promise<FactPanel> => {
		await requireRole(ctx, internalRoles);
		const title = WIKI_FACTS[key];
		switch (key) {
			case "attendance":
				return {
					title,
					rows: [
						{ label: "Oppmøtt", value: `${ATTENDANCE_POINTS.confirmed} prikker` },
						{ label: "Møtt sent", value: `${ATTENDANCE_POINTS.late} prikk` },
						{ label: "Ikke møtt", value: `${ATTENDANCE_POINTS.no_show} prikker` },
						{ label: "Grense for påmeldingssperre", value: `${POINT_LOCKOUT_THRESHOLD} prikker` },
						{
							label: "Levetid",
							value: `${POINT_LIFETIME_MS / DAY_MS} dager`,
						},
					],
				};
			case "feedback":
				return {
					title,
					rows: [
						{
							label: "Åpning",
							value: `Dagen etter arrangementet kl. ${FEEDBACK_OPEN_TIME} i Oslo`,
						},
						{
							label: "Planlagte purringer",
							value: `${REMINDER_DAYS.join(", ")} dager etter åpning`,
						},
						{ label: "Planlagt stenging", value: `${FEEDBACK_CLOSE_DAYS} dager etter åpning` },
						{
							label: "Lagringstid",
							value: `${FEEDBACK_RETENTION_MONTHS} kalendermåneder etter stenging`,
						},
					],
				};
			case "checklist":
				return {
					title,
					rows: EVENT_CHECKLIST.map((phase) => ({
						label: phase.label,
						value: phase.steps.map((step) => step.label).join(". "),
					})),
				};
			case "slack":
				return {
					title,
					rows: [
						{
							label: "Planlegging og bedriftskanal",
							value: `${EVENT_PLANNING.channelDaysBefore} dager før arrangementet`,
						},
						{
							label: "Manglende arrangementstekst",
							value: `${EVENT_PLANNING.textDaysBefore} dager før`,
						},
						{
							label: "Promotering",
							value: `${EVENT_PLANNING.promotionDaysBefore} dag før påmeldingen åpner`,
						},
						{
							label: "Ubekreftet rom, mat eller medhjelpere",
							value: `${EVENT_PLANNING.checklistDaysBefore} dager før arrangementet`,
						},
						{
							label: "Godkjenning av påminnelsesepost",
							value: `${EVENT_PLANNING.reminderReviewDaysBefore} dager før, oppfølging ${EVENT_PLANNING.reminderNagDaysBefore} dager før`,
						},
						{
							label: "Praktiske forberedelser",
							value: `${EVENT_PLANNING.practicalDaysBefore} dager før`,
						},
						{ label: "Utlegg", value: `${EVENT_PLANNING.expensesDaysAfter} dag etter` },
						{
							label: "Usendt rapport",
							value: `${EVENT_PLANNING.unsentReportAlertDaysAfter} dager etter at rapporten er klar`,
						},
						{
							label: "Tidligste arkivering",
							value: `${EVENT_PLANNING.archiveDaysAfter} dager etter at både siste arrangement og etterarbeidet er fullført`,
						},
					],
					note: "Botten følger også opp manglende oppmøte og rapportgodkjenning.",
				};
			case "products": {
				const products = await ctx.db
					.query("products")
					.withIndex("by_active_and_sortOrder", (q) => q.eq("active", true))
					.take(101);
				return {
					title,
					rows: products.slice(0, 100).map((product) => ({
						label: product.name,
						value: [
							product.unitPriceOre === undefined
								? "Pris ikke satt"
								: formatNokFromOre(product.unitPriceOre),
							`mva ${product.vatRate} %`,
							product.maxStudents ? `inntil ${product.maxStudents} studenter` : "",
							product.startupPriceOre === undefined
								? ""
								: `oppstart ${formatNokFromOre(product.startupPriceOre)}`,
							...(product.volumeTiers ?? []).map(
								(tier) => `${tier.quantity} stk: ${formatNokFromOre(tier.totalPriceOre)}`,
							),
						]
							.filter(Boolean)
							.join(", "),
					})),
					note: products.length
						? `Priser ekskl. mva.${products.length > 100 ? " Viser de første 100 produktene." : ""}`
						: "Ingen aktive produkter.",
				};
			}
			case "forms": {
				const forms = await ctx.db
					.query("feedbackForms")
					.filter((q) => q.neq(q.field("isHidden"), true))
					.take(21);
				const published = await Promise.all(
					forms.slice(0, 20).map(async (form) => {
						const version = await getLatestPublishedVersion(ctx, form._id);
						if (!version) return null;
						const fields = await ctx.db
							.query("formFields")
							.withIndex("by_formVersionId_and_order", (q) => q.eq("formVersionId", version._id))
							.take(40);
						return {
							label: `${form.name}${form.isDefault ? " (standard)" : ""}`,
							value: fields
								.map((field) => `${field.label}${field.required ? " (påkrevd)" : ""}`)
								.join("; "),
						};
					}),
				);
				const rows = published.filter((row) => row !== null);
				return {
					title,
					rows,
					note: rows.length
						? "Siste publiserte versjon. Arrangementer kan bruke en eldre versjon."
						: "Ingen publiserte skjemaer i utvalget.",
				};
			}
		}
	},
});
