import { BIFROST_URL } from "@workspace/shared/constants";
import {
	type ApplicationForm,
	applicationFormSchema,
} from "@workspace/shared/semester/application";
import { EVENT_TITLE_PREFIX } from "@workspace/shared/semester/labels";
import { formatOrderAlert } from "@workspace/shared/slack/alerts";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { osloToday } from "@workspace/shared/time";
import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import {
	internalMutation,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "../../_generated/server";
import {
	closedLinkStates,
	confirmationFields,
	confirmationState,
	validEmailToken,
} from "../../lib/emailConfirmation";
import { hashLinkToken } from "../../lib/tokens";
import { logApplicationActivity } from "../applicationLifecycle";
import { CONSENT_VERSION, FORM_VERSION } from "../rules";
import {
	applicationForm,
	brregSnapshotAtSubmission,
	presentationEventType,
	venue,
	wantsToUseEscape,
} from "../schema";
import { acceptsApplications, listSemesterDates } from "../semesters/helper";

// An application from Hugin is only received once the contact person confirms it from the email:
// submit stores it as pending and emails a link, and the link turns it into a `companyApplications`
// row. Until then Navet sees nothing, and an unconfirmed one is deleted when its last link expires.

export function parseApplicationForm(form: unknown): ApplicationForm {
	const result = applicationFormSchema.safeParse(form);
	if (!result.success) {
		throw new ConvexError(result.error.issues[0]?.message ?? "Søknaden er ugyldig.");
	}
	return result.data;
}

/**
 * The reason the semester does not take this application on `day`, or null when it does: it must
 * be open, its hard deadline not passed, and every date one of its open dates.
 */
async function refusal(
	ctx: QueryCtx,
	semester: Doc<"semesters"> | null,
	dates: readonly string[],
	day: string,
): Promise<string | null> {
	if (semester?.status !== "open") return "Søknadene er stengt.";
	if (!acceptsApplications(semester, day)) return "Søknadsfristen har gått ut.";
	const openDates = new Set(
		(await listSemesterDates(ctx, semester._id))
			.filter((date) => date.closedLabel === undefined)
			.map((date) => date.date),
	);
	if (!dates.every((date) => openDates.has(date))) {
		return "Én eller flere av datoene er ikke åpne lenger. Last inn siden på nytt.";
	}
	return null;
}

/** Stores a new emailed link and deletes the application if no link is used before it expires. */
async function addConfirmation(
	ctx: MutationCtx,
	pendingId: Id<"pendingCompanyApplications">,
	token: string,
) {
	const fields = await confirmationFields(token, Date.now());
	await ctx.db.insert("companyApplicationConfirmations", { pendingId, ...fields });
	await ctx.scheduler.runAt(
		fields.expiresAt,
		internal.semesterPlanning.applications.confirmation.purgeExpired,
		{ pendingId },
	);
}

const emailTo = v.union(v.null(), v.object({ email: v.string(), companyName: v.string() }));

function emailToOf(pending: Doc<"pendingCompanyApplications">) {
	return { email: pending.form.contact.email, companyName: pending.registry.name };
}

/**
 * Stores a checked application until it is confirmed by email. A repeated submission replaces the
 * answers and gets a new link while it is unconfirmed, and nothing once it is received. When the
 * retry has another contact email, the links sent to the old address stop working.
 *
 * @throws - A Norwegian error when the semester does not take applications or a date is not open.
 * @returns - Who to email the link to, or null when no email should go out.
 */
export const savePending = internalMutation({
	args: {
		semesterId: v.id("semesters"),
		form: applicationForm,
		submissionId: v.string(),
		registry: brregSnapshotAtSubmission,
		token: v.string(),
	},
	returns: emailTo,
	handler: async (ctx, { semesterId, form, submissionId, registry, token }) => {
		const received = await ctx.db
			.query("companyApplications")
			.withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
			.first();
		if (received) return null;

		const already = await ctx.db
			.query("pendingCompanyApplications")
			.withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
			.unique();
		if (already?.applicationId) return null;

		const parsed = parseApplicationForm(form);
		const now = Date.now();
		const reason = await refusal(
			ctx,
			await ctx.db.get(semesterId),
			parsed.availableDates,
			osloToday(now),
		);
		if (reason) throw new ConvexError(reason);

		const answers = { semesterId, form: parsed, registry, submittedAt: now };
		let pendingId: Id<"pendingCompanyApplications">;
		if (already) {
			if (already.form.contact.email !== parsed.contact.email) {
				await deleteConfirmations(ctx, already._id);
			}
			await ctx.db.patch(already._id, answers);
			pendingId = already._id;
		} else {
			pendingId = await ctx.db.insert("pendingCompanyApplications", { submissionId, ...answers });
		}
		await addConfirmation(ctx, pendingId, token);
		return { email: parsed.contact.email, companyName: registry.name };
	},
});

async function deleteConfirmations(
	ctx: MutationCtx,
	pendingId: Id<"pendingCompanyApplications">,
	keepUnexpired = false,
): Promise<boolean> {
	const now = Date.now();
	const confirmations = await ctx.db
		.query("companyApplicationConfirmations")
		.withIndex("by_pendingId", (q) => q.eq("pendingId", pendingId))
		.collect();
	if (keepUnexpired && confirmations.some((confirmation) => confirmation.expiresAt > now)) {
		return false;
	}
	await Promise.all(confirmations.map((confirmation) => ctx.db.delete(confirmation._id)));
	return true;
}

/** A new link for an unconfirmed application, or null when there is none to confirm. */
export const addConfirmationToken = internalMutation({
	args: { submissionId: v.string(), token: v.string() },
	returns: emailTo,
	handler: async (ctx, { submissionId, token }) => {
		const pending = await ctx.db
			.query("pendingCompanyApplications")
			.withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
			.unique();
		if (!pending || pending.applicationId) return null;
		await addConfirmation(ctx, pending._id, token);
		return emailToOf(pending);
	},
});

async function openLink(ctx: QueryCtx, token: string, now: number) {
	if (!validEmailToken(token)) return { state: "invalid" as const };
	const tokenHash = await hashLinkToken(token);
	const confirmation = await ctx.db
		.query("companyApplicationConfirmations")
		.withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
		.unique();
	const pending = confirmation ? await ctx.db.get(confirmation.pendingId) : null;
	if (!confirmation || !pending) return { state: "invalid" as const };
	if (confirmationState(confirmation, now) === "expired") return { state: "expired" as const };
	if (pending.applicationId) return { state: "confirmed" as const, pending };
	return { state: "pending" as const, confirmation, pending };
}

const receipt = v.object({
	company: v.object({ name: v.string(), orgNumber: v.string() }),
	eventType: presentationEventType,
	minStudents: v.number(),
	maxStudents: v.number(),
	availableDates: v.array(v.string()),
	venue,
	wantsToUseEscape,
	billing: v.object({ email: v.optional(v.string()), details: v.optional(v.string()) }),
	applicationDeadline: v.optional(v.string()),
	late: v.boolean(),
});

export type ApplicationReceipt = Infer<typeof receipt>;

/** What the receipt shows: the answers, without contact details. */
async function receiptFor(
	ctx: QueryCtx,
	pending: Doc<"pendingCompanyApplications">,
): Promise<ApplicationReceipt> {
	const { form } = pending;
	const semester = await ctx.db.get(pending.semesterId);
	const deadline = semester?.applicationDeadline;
	return {
		company: { name: pending.registry.name, orgNumber: form.orgNumber },
		eventType: form.eventType,
		minStudents: form.minStudents,
		maxStudents: form.maxStudents,
		availableDates: form.availableDates,
		venue: form.venue,
		wantsToUseEscape: form.wantsToUseEscape,
		billing: { email: form.billing.email, details: form.billing.details },
		applicationDeadline: deadline,
		late: deadline !== undefined && osloToday(pending.submittedAt) > deadline,
	};
}

const closedLink = closedLinkStates(receipt);

/** What an emailed link leads to, before the company presses confirm. */
export const link = query({
	args: { token: v.string() },
	returns: v.union(v.object({ state: v.literal("pending") }), ...closedLink),
	handler: async (ctx, { token }) => {
		const link = await openLink(ctx, token, Date.now());
		if (link.state === "confirmed") {
			return { state: link.state, receipt: await receiptFor(ctx, link.pending) };
		}
		return { state: link.state };
	},
});

/**
 * Confirms an application from its emailed link: saves it as received, records «received» in the
 * history and alerts Navet. The deadline is checked against the day it was sent, so confirming the
 * morning after still counts. Opening the link again shows the same receipt.
 */
export const confirm = mutation({
	args: { token: v.string() },
	returns: v.union(...closedLink, v.object({ state: v.literal("refused"), message: v.string() })),
	handler: async (ctx, { token }) => {
		const now = Date.now();
		const link = await openLink(ctx, token, now);
		if (link.state === "expired" || link.state === "invalid") return { state: link.state };
		if (link.state === "pending") {
			const { confirmation, pending } = link;
			const reason = await refusal(
				ctx,
				await ctx.db.get(pending.semesterId),
				pending.form.availableDates,
				osloToday(pending.submittedAt),
			);
			if (reason) return { state: "refused" as const, message: reason };

			const applicationId = await receiveApplication(ctx, pending, now);
			await ctx.db.patch(confirmation._id, { usedAt: now });
			await ctx.db.patch(pending._id, { applicationId });
		}
		return { state: "confirmed" as const, receipt: await receiptFor(ctx, link.pending) };
	},
});

/**
 * Saves a confirmed application, records it in the history, alerts Navet in Slack and adds it to
 * the Google Sheet copy.
 */
async function receiveApplication(
	ctx: MutationCtx,
	pending: Doc<"pendingCompanyApplications">,
	now: number,
): Promise<Id<"companyApplications">> {
	const { consent: _consent, billing, ...answers } = pending.form;
	const applicationId = await ctx.db.insert("companyApplications", {
		...answers,
		semesterId: pending.semesterId,
		submissionId: pending.submissionId,
		formVersion: FORM_VERSION,
		registry: pending.registry,
		billing,
		consent: { version: CONSENT_VERSION, consentedAt: now },
		status: "applied",
	});

	await logApplicationActivity(ctx, applicationId, "submitted", { type: "company" });
	const product = await ctx.db
		.query("products")
		.withIndex("by_eventType_and_active", (q) =>
			q.eq("eventType", answers.eventType).eq("active", true),
		)
		.first();
	const companyName = pending.registry.name;
	await ctx.scheduler.runAfter(0, internal.iam.notifications.sendMessage, {
		channel: SYSTEM_ALERTS_CHANNEL,
		clientMsgId: `bedpres-order-${applicationId}`,
		text: formatOrderAlert({
			company: companyName,
			type: "Bedriftspresentasjon",
			title: `${EVENT_TITLE_PREFIX[answers.eventType]} ${companyName}`,
			additionalNotes: [answers.description.trim(), answers.additionalInfo?.trim()]
				.filter(Boolean)
				.join("\n"),
			estimatedRevenueOre: product?.unitPriceOre,
			url: `${BIFROST_URL}/semesterplan/soknad/${applicationId}`,
		}),
	});
	await ctx.scheduler.runAfter(0, internal.semesterPlanning.applications.sheet.appendApplication, {
		applicationId,
	});
	return applicationId;
}

/**
 * Deletes a pending application and its links once the last link has expired. A received application
 * lives on in `companyApplications`; an unconfirmed one was never sent to Navet.
 */
export const purgeExpired = internalMutation({
	args: { pendingId: v.id("pendingCompanyApplications") },
	returns: v.null(),
	handler: async (ctx, { pendingId }) => {
		const deleted = await deleteConfirmations(ctx, pendingId, true);
		if (deleted && (await ctx.db.get(pendingId))) await ctx.db.delete(pendingId);
		return null;
	},
});
