import { HUGIN_LOCAL_URL, HUGIN_URL } from "@workspace/shared/constants";
import { INFO_EMAIL } from "@workspace/shared/constants/contact";
import {
	AGE_BY_ALCOHOL,
	type PlanningAnswers,
	planningCapacityLimit,
	planningFormSchema,
	validContactEmail,
} from "@workspace/shared/events/planning";
import { EVENT_TYPE_LABELS } from "@workspace/shared/semester/labels";
import { formatOsloDate, osloDateTimeToEpoch, osloToday } from "@workspace/shared/time";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { findCompanyLogoUrl } from "../../companies/helper";
import { accountForUser } from "../../iam/accounts";
import { sanitizeRichText } from "../../jobListingOrders/sanitize";
import { validEmailToken } from "../../lib/emailConfirmation";
import { hashLinkToken } from "../../lib/tokens";
import { getOrganizers } from "../queries";

export const eventArgsError = "Arrangementet er avsluttet eller utilgjengelig.";
export function planningForEvent(ctx: QueryCtx, eventId: Id<"events">) {
	return ctx.db
		.query("eventPlanning")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.unique();
}
export async function requireEvent(ctx: QueryCtx, id: Id<"events">, now?: number) {
	const event = await ctx.db.get(id);
	if (!event || event.externalEvent || (now !== undefined && event.eventStart <= now))
		throw new ConvexError(eventArgsError);
	return event;
}
export function eventSnapshot(event: Doc<"events">) {
	return JSON.stringify([
		event.title,
		event.teaser,
		event.description,
		event.eventStart,
		event.registrationOpens,
		event.participationLimit,
		event.location,
		event.foodItem ?? null,
		event.language,
		event.ageRestriction,
		event.hostingCompany,
		event.product ?? null,
		event.published,
	]);
}
export function publicUrl(path: string, token: string) {
	const url = new URL(path, isLocalDevelopment() ? HUGIN_LOCAL_URL : HUGIN_URL);
	url.hash = new URLSearchParams({ token }).toString();
	return url.toString();
}
export async function senderFor(ctx: QueryCtx, eventId: Id<"events">) {
	const organizers = await getOrganizers(ctx, eventId);
	const contacts = await Promise.all(
		organizers.map(async (organizer) => {
			const account = await accountForUser(ctx, organizer.userId, organizer.email);
			return {
				...organizer,
				email: account?.stage === "active" ? account.workspaceEmail : organizer.email,
			};
		}),
	);
	const main = contacts.find((o) => o.role === "hovedansvarlig");
	const position = main
		? await ctx.db
				.query("internals")
				.withIndex("by_userId", (q) => q.eq("userId", main.userId))
				.first()
		: null;
	const verifiedDomain = process.env.PLANNING_VERIFIED_SENDER_DOMAIN?.trim().toLowerCase();
	const canSendAs =
		main && verifiedDomain && main.email.split("@")[1]?.toLowerCase() === verifiedDomain;
	return {
		from: canSendAs
			? `${main.name.replace(/[<>\r\n]/g, "")} <${main.email}>`
			: `Navet <${INFO_EMAIL}>`,
		cc: [...new Set(contacts.map((o) => o.email).filter(Boolean))],
		replyTo: main?.email ? [main.email] : [],
		signature: main
			? `${main.name}\n${position?.position ?? "Kontaktperson"} - Navet\n${main.email}`
			: "",
		complete: !!main && contacts.length >= 2 && contacts.every((o) => validContactEmail(o.email)),
		mainName: main?.name ?? "",
		mainEmail: main?.email ?? "",
		contacts: contacts.map(({ name, email, role }) => ({ name, email, role })),
	};
}
export async function initialPlanning(ctx: QueryCtx, event: Doc<"events">) {
	const [order, sender, food] = await Promise.all([
		ctx.db
			.query("companyApplications")
			.withIndex("by_eventId", (q) => q.eq("eventId", event._id))
			.first(),
		senderFor(ctx, event._id),
		event.foodItem ? ctx.db.get(event.foodItem) : null,
	]);
	const product = event.product ? await ctx.db.get(event.product.productId) : null;
	const known = (value: string) => (value === "Mer info kommer" ? "" : value);
	let venue: PlanningAnswers["venue"] = "unsure";
	if (order?.wantsToUseEscape === "yes") venue = "escape";
	else if (order?.venue === "campus") venue = "campus";
	else if (order?.venue === "own_premises") venue = "own";
	let foodAndDrinks: PlanningAnswers["foodAndDrinks"] = "unsure";
	if (order) foodAndDrinks = order.foodAndDrinks ? "yes" : "no";
	const answers: PlanningAnswers = {
		title: known(event.title),
		teaser: known(event.teaser),
		description: known(event.description) || order?.description || "",
		capacity: event.participationLimit,
		startTime: "16:15",
		venue,
		location: known(event.location),
		food: food?.name ?? event.food ?? "",
		foodAndDrinks,
		foodPurchasedBy: order?.foodPurchasedBy ?? "undecided",
		alcohol: "unsure",
		ageRestriction: "unsure",
		stand: "unsure",
		standDetails: "",
		language: known(event.language),
		notes: "",
	};
	return {
		answers,
		contactName: order?.contact.name ?? "",
		contactEmail: order?.contact.email ?? "",
		signature: sender.signature,
		eventType: order?.eventType ?? (event.productGuessed ? undefined : product?.eventType),
	};
}
export async function ensurePlanning(ctx: MutationCtx, event: Doc<"events">) {
	const existing = await planningForEvent(ctx, event._id);
	if (existing) return existing;
	const initial = await initialPlanning(ctx, event);
	const id = await ctx.db.insert("eventPlanning", {
		eventId: event._id,
		companyId: event.hostingCompany,
		...initial,
		revision: 0,
		generation: 0,
		status: event.completedChecklistSteps?.includes("company-contact") ? "manual" : "preparing",
	});
	return (await ctx.db.get(id))!;
}
export async function capacityLimit(
	ctx: QueryCtx,
	planning: Pick<Doc<"eventPlanning">, "eventType">,
	event: Doc<"events">,
) {
	if (!planning.eventType) return 1000;
	const product =
		event.product && !event.productGuessed ? await ctx.db.get(event.product.productId) : null;
	return Math.min(
		planningCapacityLimit(planning.eventType),
		product?.eventType === planning.eventType ? (product.maxStudents ?? 1000) : 1000,
	);
}
export async function parseAnswers(
	ctx: QueryCtx,
	planning: Pick<Doc<"eventPlanning">, "eventType">,
	event: Doc<"events">,
	input: PlanningAnswers,
) {
	const parsed = planningFormSchema(await capacityLimit(ctx, planning, event)).safeParse(input);
	if (!parsed.success)
		throw new ConvexError(parsed.error.issues[0]?.message ?? "Kontroller opplysningene.");
	try {
		osloDateTimeToEpoch(osloToday(event.eventStart), parsed.data.startTime);
	} catch {
		throw new ConvexError("Velg et klokkeslett som finnes på arrangementsdatoen.");
	}
	return {
		...parsed.data,
		ageRestriction: AGE_BY_ALCOHOL[parsed.data.alcohol],
		description: sanitizeRichText(parsed.data.description),
	};
}
export function envelopeFingerprint(envelope: Doc<"eventPlanningEmails">["envelope"]) {
	return JSON.stringify([
		envelope.from,
		envelope.to,
		[...envelope.cc].sort((a, b) => a.localeCompare(b)),
		envelope.replyTo,
		envelope.subject,
		envelope.text,
	]);
}
export async function invitationPreview(
	ctx: QueryCtx,
	planning: Doc<"eventPlanning">,
	event: Doc<"events">,
) {
	const sender = await senderFor(ctx, event._id);
	const blockers = [
		...(!validContactEmail(planning.contactEmail) || !planning.contactName.trim()
			? ["Fyll inn navn og e-post til bedriftens kontaktperson."]
			: []),
		...(!sender.complete
			? ["Velg hovedansvarlig og medhjelper med gyldige e-postadresser på arrangementet."]
			: []),
		...(!planning.signature.trim() ? ["Fyll inn arrangørens signatur."] : []),
		...(!planning.eventType ? ["Bekreft avtalt arrangementstype."] : []),
		...(planning.companyId !== event.hostingCompany
			? ["Bedriften er endret. Klargjør opplysningene på nytt."]
			: []),
	];
	const envelope = {
		from: sender.from,
		to: planning.contactEmail,
		cc: sender.cc.filter((email) => email !== planning.contactEmail),
		replyTo: sender.replyTo,
		subject: `Planlegg bedriftspresentasjon med Navet ${formatOsloDate(event.eventStart, "d. MMMM")}`,
		text: `Hei ${planning.contactName}!\n\nJeg er kontaktpersonen deres fra Navet for arrangementet ${formatOsloDate(event.eventStart, "EEEE d. MMMM yyyy")}. Vi gleder oss til å møte dere!\n\nVi har gjort klart et skjema med opplysningene vi allerede har. Se gjerne over og fyll inn det dere vet om innholdet og det praktiske. Dere kan bruke samme lenke for å oppdatere senere.\n\nVi trenger tittel, introduksjon og beskrivelse før påmeldingen åpner. Kontakt meg gjerne hvis dere har spørsmål eller ønsker å ha et møte. Velg gjerne «svar alle», så får medansvarlige også med seg samtalen.\n\nMed vennlig hilsen\n${planning.signature}`,
	};
	return {
		envelope,
		blockers,
		fingerprint: JSON.stringify([
			envelope,
			event.eventStart,
			event.hostingCompany,
			planning.revision,
		]),
	};
}
export async function planningByToken(ctx: QueryCtx, token: string) {
	if (!validEmailToken(token)) return null;
	const hash = await hashLinkToken(token);
	const planning = await ctx.db
		.query("eventPlanning")
		.withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
		.unique();
	const event = planning ? await ctx.db.get(planning.eventId) : null;
	if (
		planning?.status !== "invited" ||
		!event ||
		event.externalEvent ||
		planning.companyId !== event.hostingCompany
	)
		return null;
	return { planning, event };
}
export async function companyView(
	ctx: QueryCtx,
	planning: Pick<Doc<"eventPlanning">, "companyId" | "eventType">,
) {
	const company = await ctx.db.get(planning.companyId);
	return {
		companyName: company?.name ?? "",
		eventType: planning.eventType,
		logoUrl: company ? await findCompanyLogoUrl(ctx, company._id) : null,
		packageName: planning.eventType ? EVENT_TYPE_LABELS[planning.eventType] : "Bedriftsarrangement",
	};
}
