import type { EmailId } from "@convex-dev/resend";
import { splitPlanningEmail } from "@workspace/shared/events/planning-email";
import { HOUR_MS, MINUTE_MS } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { trackedEmail } from "../../lib/trackedEmail";
import { envelopeFingerprint, invitationPreview } from "./helpers";
import { notifyInvitationSent, notifyPlanning } from "./notifications";

export type EmailDraft = Omit<
	Doc<"eventPlanningEmails">,
	"_id" | "_creationTime" | "status" | "attempts" | "nextAttemptAt"
> & { url: string };
export async function queueEmail(ctx: MutationCtx, draft: EmailDraft) {
	const id = await ctx.db.insert("eventPlanningEmails", {
		...draft,
		status: "pending",
		attempts: 0,
		nextAttemptAt: Date.now(),
	});
	await ctx.scheduler.runAfter(0, internal.events.planning.mail.deliver, { id });
	return id;
}
export const getEmail = internalQuery({
	args: { id: v.id("eventPlanningEmails") },
	handler: (ctx, { id }) => ctx.db.get(id),
});
export const enqueueRendered = internalMutation({
	args: { id: v.id("eventPlanningEmails"), html: v.string() },
	handler: async (ctx, { id, html }): Promise<void> => {
		const email = await ctx.db.get(id);
		if (email?.status !== "pending") return;
		if (!email.url) throw new Error("Missing pending email link");
		const planning = await ctx.db.get(email.planningId);
		const event = planning ? await ctx.db.get(planning.eventId) : null;
		if (
			!planning ||
			planning.generation !== email.generation ||
			planning.status !== "invited" ||
			!event ||
			event.externalEvent ||
			event.hostingCompany !== planning.companyId ||
			event.eventStart <= Date.now() ||
			(email.kind === "invitation" && event.eventStart !== email.eventStart)
		) {
			await cancelOutdatedEmail(ctx, email, planning);
			return;
		}
		if (email.kind === "invitation") {
			const preview = await invitationPreview(ctx, planning, event);
			if (
				preview.blockers.length ||
				envelopeFingerprint(preview.envelope) !== envelopeFingerprint(email.envelope)
			) {
				const error = "Mottaker eller arrangør er endret. Kontroller invitasjonen og send på nytt.";
				await ctx.db.patch(id, { status: "cancelled", error, url: undefined });
				await ctx.db.patch(planning._id, {
					status: "preparing",
					tokenHash: undefined,
					error,
					revision: planning.revision + 1,
				});
				await alertFailure(ctx, email, error);
				return;
			}
		}
		if (email.submissionId) {
			const submission = await ctx.db.get(email.submissionId);
			if (submission?.status !== "awaiting_email") {
				await ctx.db.patch(id, { status: "cancelled", url: undefined });
				return;
			}
		}
		const { body, signature } = splitPlanningEmail(email.envelope.text);
		const emailId = isLocalDevelopment()
			? `local:${id}`
			: await trackedEmail.sendEmail(ctx, {
					...email.envelope,
					html,
					text: [body, email.url, signature].filter(Boolean).join("\n\n"),
					idempotencyKey: `planning:${id}`,
				});
		await ctx.db.patch(id, {
			emailId,
			url: undefined,
			status: isLocalDevelopment() ? "sent" : "queued",
			error: undefined,
			nextAttemptAt: Date.now() + HOUR_MS,
		});
	},
});
async function cancelOutdatedEmail(
	ctx: MutationCtx,
	email: Doc<"eventPlanningEmails">,
	planning: Doc<"eventPlanning"> | null,
) {
	await ctx.db.patch(email._id, { status: "cancelled", url: undefined });
	if (
		!planning ||
		planning.generation !== email.generation ||
		planning.status !== "invited" ||
		email.kind !== "invitation"
	)
		return;
	const error = "Arrangementet er endret. Kontroller invitasjonen og send på nytt.";
	await ctx.db.patch(planning._id, { status: "preparing", tokenHash: undefined, error });
	await ctx.db.patch(email._id, { error });
	await alertFailure(ctx, email, error);
}

export const recordFailure = internalMutation({
	args: { id: v.id("eventPlanningEmails"), message: v.string() },
	handler: async (ctx, { id, message }) => {
		const email = await ctx.db.get(id);
		if (email?.status !== "pending") return;
		const attempts = email.attempts + 1;
		await ctx.db.patch(id, {
			attempts,
			error: message,
			status: attempts >= 5 ? "failed" : "pending",
			...(attempts >= 5 ? { url: undefined } : {}),
			nextAttemptAt: Date.now() + Math.min(60, 2 ** attempts) * MINUTE_MS,
		});
		await alertFailure(ctx, email, message);
	},
});
async function alertFailure(
	ctx: MutationCtx,
	email: Doc<"eventPlanningEmails">,
	message: string,
	category = "send",
) {
	const planning = await ctx.db.get(email.planningId);
	const event = planning ? await ctx.db.get(planning.eventId) : null;
	if (event)
		await notifyPlanning(
			ctx,
			event,
			`email-error:${email._id}:${category}`,
			`E-post for arrangementsplanlegging trenger oppfølging: ${message}`,
			"delivery",
		);
}
export const recordProviderEvent = internalMutation({
	args: { emailId: v.string(), type: v.string() },
	handler: async (ctx, { emailId, type }): Promise<boolean> => {
		const email = await ctx.db
			.query("eventPlanningEmails")
			.withIndex("by_emailId", (q) => q.eq("emailId", emailId))
			.unique();
		if (!email) return false;
		const statuses: Record<string, Doc<"eventPlanningEmails">["status"]> = {
			"email.sent": "sent",
			"email.delivered": "delivered",
			"email.delivery_delayed": "delayed",
			"email.bounced": "bounced",
			"email.complained": "complained",
			"email.failed": "failed",
			"email.suppressed": "failed",
		};
		const status = statuses[type];
		if (!status || email.status === "cancelled") return true;
		const terminal = ["bounced", "complained", "failed"].includes(email.status);
		if (
			terminal ||
			(email.status === "delivered" && ["queued", "sent", "delayed"].includes(status))
		)
			return true;
		const failed = ["bounced", "complained", "failed", "delayed"].includes(status);
		const messages: Partial<Record<Doc<"eventPlanningEmails">["status"], string>> = {
			bounced: "Mottakerens server avviste e-posten. Kontroller adressen.",
			complained: "E-posten ble markert som søppelpost. Følg opp manuelt.",
			delayed: "Leveringen er forsinket. Sjekk leveringsstatus før ny sending.",
		};
		const message =
			messages[status] ?? "E-posten kunne ikke sendes. Kontroller leveringsoppsettet.";
		await ctx.db.patch(email._id, {
			url: undefined,
			status,
			...(failed ? { error: message } : { error: undefined }),
			...(status === "sent" ? { sentAt: email.sentAt ?? Date.now() } : {}),
			...(status === "delivered"
				? { deliveredAt: Date.now(), sentAt: email.sentAt ?? Date.now() }
				: {}),
		});
		if (failed) await alertFailure(ctx, email, message, status);
		await notifyInvitationSent(ctx, email, status);
		return true;
	},
});

export const recover = internalMutation({
	args: {},
	handler: async (ctx) => {
		const pending = await ctx.db
			.query("eventPlanningEmails")
			.withIndex("by_status_and_nextAttemptAt", (q) =>
				q.eq("status", "pending").lte("nextAttemptAt", Date.now()),
			)
			.take(50);
		await Promise.all(
			pending.map(async (email) => {
				await ctx.db.patch(email._id, { nextAttemptAt: Date.now() + 5 * MINUTE_MS });
				await ctx.scheduler.runAfter(0, internal.events.planning.mail.deliver, { id: email._id });
			}),
		);
		const batches = await Promise.all(
			(["queued", "sent", "delayed"] as const).map((status) =>
				ctx.db
					.query("eventPlanningEmails")
					.withIndex("by_status_and_nextAttemptAt", (q) =>
						q.eq("status", status).lte("nextAttemptAt", Date.now()),
					)
					.take(30),
			),
		);
		await Promise.all(batches.flat().map((email) => recoverEmail(ctx, email)));
	},
});

async function recoverEmail(ctx: MutationCtx, email: Doc<"eventPlanningEmails">) {
	await ctx.db.patch(email._id, { nextAttemptAt: Date.now() + HOUR_MS, url: undefined });
	if (!email.emailId || email.emailId.startsWith("local:")) return;
	const provider = await trackedEmail.status(ctx, email.emailId as EmailId);
	if (provider?.status === "delivered" && !provider.complained) {
		await ctx.db.patch(email._id, {
			status: "delivered",
			error: undefined,
			deliveredAt: Date.now(),
			sentAt: email.sentAt ?? Date.now(),
		});
		await notifyInvitationSent(ctx, email, "delivered");
		return;
	}
	let status = email.status;
	let error = "Levering er ikke bekreftet ennå. Kontroller før eventuell ny sending.";
	if (provider?.complained) {
		status = "complained";
		error = "E-posten ble markert som søppelpost. Følg opp manuelt.";
	} else if (provider && ["failed", "bounced", "cancelled"].includes(provider.status)) {
		status = provider.status === "bounced" ? "bounced" : "failed";
		error = "Leveringen feilet hos e-postleverandøren.";
	} else if (email.resolvedAt) return;
	await ctx.db.patch(email._id, { status, error });
	await alertFailure(ctx, email, error);
}
