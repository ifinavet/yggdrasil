import type { EmailId } from "@convex-dev/resend";
import { HOUR_MS, MINUTE_MS } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { trackedEmail } from "../../lib/trackedEmail";
import { envelopeFingerprint, invitationPreview } from "./helpers";
import { notifyPlanning } from "./notifications";

export type EmailDraft = Omit<
	Doc<"eventPlanningEmails">,
	"_id" | "_creationTime" | "status" | "attempts" | "nextAttemptAt"
>;
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
		if (!email || email.status !== "pending") return;
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
			await ctx.db.patch(id, { status: "cancelled" });
			if (
				planning &&
				planning.generation === email.generation &&
				planning.status === "invited" &&
				email.kind === "invitation"
			) {
				await ctx.db.patch(planning._id, {
					status: "preparing",
					tokenHash: undefined,
					error: "Arrangementet er endret. Kontroller invitasjonen og send på nytt.",
				});
				await ctx.db.patch(id, {
					error: "Arrangementet er endret. Kontroller invitasjonen og send på nytt.",
				});
				await alertFailure(
					ctx,
					email,
					"Arrangementet er endret. Kontroller invitasjonen og send på nytt.",
				);
			}
			return;
		}
		if (email.kind === "invitation") {
			const preview = await invitationPreview(ctx, planning, event);
			if (
				preview.blockers.length ||
				envelopeFingerprint(preview.envelope) !== envelopeFingerprint(email.envelope)
			) {
				const error = "Mottaker eller arrangør er endret. Kontroller invitasjonen og send på nytt.";
				await ctx.db.patch(id, { status: "cancelled", error });
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
				await ctx.db.patch(id, { status: "cancelled" });
				return;
			}
		}
		const emailId = isLocalDevelopment()
			? `local:${id}`
			: await trackedEmail.sendEmail(ctx, {
					...email.envelope,
					html,
					text: `${email.envelope.text}\n\n${email.url}`,
					idempotencyKey: `planning:${id}`,
				});
		await ctx.db.patch(id, {
			emailId,
			status: isLocalDevelopment() ? "sent" : "queued",
			error: undefined,
			nextAttemptAt: Date.now() + HOUR_MS,
		});
	},
});
export const recordFailure = internalMutation({
	args: { id: v.id("eventPlanningEmails"), message: v.string() },
	handler: async (ctx, { id, message }) => {
		const email = await ctx.db.get(id);
		if (!email || email.status !== "pending") return;
		const attempts = email.attempts + 1;
		await ctx.db.patch(id, {
			attempts,
			error: message,
			status: attempts >= 5 ? "failed" : "pending",
			nextAttemptAt: Date.now() + Math.min(60, 2 ** attempts) * MINUTE_MS,
		});
		await alertFailure(ctx, email, message);
	},
});
async function alertFailure(ctx: MutationCtx, email: Doc<"eventPlanningEmails">, message: string) {
	const planning = await ctx.db.get(email.planningId);
	const event = planning ? await ctx.db.get(planning.eventId) : null;
	if (event)
		await notifyPlanning(
			ctx,
			event,
			`email-error:${email._id}`,
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
		const message =
			status === "bounced"
				? "Mottakerens server avviste e-posten. Kontroller adressen."
				: status === "complained"
					? "E-posten ble markert som søppelpost. Følg opp manuelt."
					: status === "delayed"
						? "Leveringen er forsinket. Sjekk leveringsstatus før ny sending."
						: "E-posten kunne ikke sendes. Kontroller leveringsoppsettet.";
		await ctx.db.patch(email._id, {
			status,
			...(failed ? { error: message } : { error: undefined }),
			...(status === "sent" ? { sentAt: email.sentAt ?? Date.now() } : {}),
			...(status === "delivered"
				? { deliveredAt: Date.now(), sentAt: email.sentAt ?? Date.now() }
				: {}),
		});
		if (failed) await alertFailure(ctx, email, message);
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
		for (const email of pending) {
			await ctx.db.patch(email._id, { nextAttemptAt: Date.now() + 5 * MINUTE_MS });
			await ctx.scheduler.runAfter(0, internal.events.planning.mail.deliver, { id: email._id });
		}
		for (const status of ["queued", "sent", "delayed"] as const) {
			const rows = await ctx.db
				.query("eventPlanningEmails")
				.withIndex("by_status_and_nextAttemptAt", (q) =>
					q.eq("status", status).lte("nextAttemptAt", Date.now()),
				)
				.take(30);
			for (const email of rows) {
				if (!email.emailId || email.emailId.startsWith("local:")) {
					await ctx.db.patch(email._id, { nextAttemptAt: Date.now() + HOUR_MS });
					continue;
				}
				const provider = await trackedEmail.status(ctx, email.emailId as EmailId);
				if (provider?.status === "delivered" && !provider.complained) {
					await ctx.db.patch(email._id, {
						status: "delivered",
						error: undefined,
						deliveredAt: Date.now(),
						sentAt: email.sentAt ?? Date.now(),
					});
				} else if (provider?.complained) {
					await ctx.db.patch(email._id, {
						status: "complained",
						error: "E-posten ble markert som søppelpost. Følg opp manuelt.",
					});
					await alertFailure(ctx, email, "E-posten ble markert som søppelpost.");
				} else if (
					provider?.status === "failed" ||
					provider?.status === "bounced" ||
					provider?.status === "cancelled"
				) {
					await ctx.db.patch(email._id, {
						status: provider.status === "bounced" ? "bounced" : "failed",
						error: "Leveringen feilet hos e-postleverandøren.",
					});
					await alertFailure(ctx, email, "Leveringen feilet hos e-postleverandøren.");
				} else if (!email.resolvedAt) {
					await ctx.db.patch(email._id, {
						error: "Levering er ikke bekreftet ennå. Kontroller før eventuell ny sending.",
					});
					await alertFailure(ctx, email, "Levering er ikke bekreftet ennå.");
				}
				await ctx.db.patch(email._id, { nextAttemptAt: Date.now() + HOUR_MS });
			}
		}
	},
});
