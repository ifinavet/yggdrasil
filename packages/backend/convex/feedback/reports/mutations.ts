import { reportRecipientSchema } from "@workspace/shared/feedback/report";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { type MutationCtx, mutation } from "../../_generated/server";
import { feedbackConfig } from "../constants";
import { isReportFeatureEnabled, requireReportAccess } from "./access";

async function editableReport(ctx: MutationCtx, reportId: Id<"feedbackReports">, revision: number) {
	const report = await ctx.db.get(reportId);
	if (!report) throw new ConvexError("Rapporten finnes ikke.");
	const user = await requireReportAccess(ctx, report.eventId);
	if (!isReportFeatureEnabled()) throw new ConvexError("Rapportfunksjonen er slått av.");
	if (Date.now() >= report.retentionAt)
		throw new ConvexError("Lagringstiden for rapporten er utløpt.");
	if (report.revision !== revision)
		throw new ConvexError(
			"Rapporten er endret. Se gjennom den oppdaterte forhåndsvisningen og prøv igjen.",
		);
	return { report, user };
}
const reportArgs = { reportId: v.id("feedbackReports"), revision: v.number() };
export const setAnswerVisibility = mutation({
	args: { ...reportArgs, answerId: v.id("feedbackReportAnswers"), visible: v.boolean() },
	handler: async (ctx, args) => {
		const { report } = await editableReport(ctx, args.reportId, args.revision);
		if (report.status !== "draft") throw new ConvexError("En godkjent rapport kan ikke endres.");
		const answer = await ctx.db.get(args.answerId);
		if (!answer || answer.reportId !== report._id)
			throw new ConvexError("Svaret finnes ikke i denne rapporten.");
		await ctx.db.patch(answer._id, { visible: args.visible });
		await ctx.db.patch(report._id, { revision: report.revision + 1 });
	},
});
export const approve = mutation({
	args: { ...reportArgs, recipientEmail: v.string() },
	handler: async (ctx, args) => {
		const { report, user } = await editableReport(ctx, args.reportId, args.revision);
		if (report.totalResponses === 0)
			throw new ConvexError("Rapporten har ingen svar og kan ikke sendes.");
		if (report.status !== "draft")
			throw new ConvexError("Rapporten er allerede godkjent eller utilgjengelig.");
		const recipient = reportRecipientSchema.safeParse({ recipientEmail: args.recipientEmail });
		if (!recipient.success) throw new ConvexError("Skriv inn en gyldig e-postadresse.");
		if (!feedbackConfig.emailsEnabled || !feedbackConfig.reportEmailsEnabled)
			throw new ConvexError("Utsending av rapporter er slått av.");
		await ctx.db.patch(report._id, {
			status: "approved",
			approvedBy: user._id,
			approvedAt: Date.now(),
			recipientEmail: recipient.data.recipientEmail,
			deliveryStatus: "pending",
			revision: report.revision + 1,
		});
		await ctx.scheduler.runAfter(0, internal.feedback.reports.mail.sendReportEmail, {
			reportId: report._id,
		});
	},
});
export const retryDelivery = mutation({
	args: reportArgs,
	handler: async (ctx, args) => {
		const { report } = await editableReport(ctx, args.reportId, args.revision);
		if (report.status !== "approved" || report.deliveryStatus !== "failed")
			throw new ConvexError("Rapporten kan ikke sendes på nytt nå.");
		if (!feedbackConfig.emailsEnabled || !feedbackConfig.reportEmailsEnabled)
			throw new ConvexError("Utsending av rapporter er slått av.");
		await ctx.db.patch(report._id, {
			deliveryStatus: "pending",
			emailId: undefined,
			tokenHash: undefined,
			deliveryAttempt: (report.deliveryAttempt ?? 0) + 1,
		});
		await ctx.scheduler.runAfter(0, internal.feedback.reports.mail.sendReportEmail, {
			reportId: report._id,
		});
	},
});
export const revoke = mutation({
	args: reportArgs,
	handler: async (ctx, args) => {
		const { report } = await editableReport(ctx, args.reportId, args.revision);
		if (report.status !== "approved") throw new ConvexError("Rapporten er ikke delt.");
		await ctx.db.patch(report._id, {
			status: "revoked",
			tokenHash: undefined,
			revision: report.revision + 1,
		});
	},
});
