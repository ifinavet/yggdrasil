import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { googleConfig, slackConfig, slackInviteLink, workspaceDomain } from "./config";

const MAX_ROWS = 200;

export const overview = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);

		const latest = (stage: Doc<"memberAccounts">["stage"]) =>
			ctx.db
				.query("memberAccounts")
				.withIndex("by_stage", (q) => q.eq("stage", stage))
				.order("desc")
				.take(MAX_ROWS);
		const [onboarding, active, offboarding, offboarded, cancelled] = await Promise.all([
			latest("onboarding"),
			latest("active"),
			latest("offboarding"),
			latest("offboarded"),
			latest("cancelled"),
		]);

		const accounts = [
			...onboarding,
			...active.filter((account) => !account.welcomeSentAt && account.lastError),
			...offboarding,
			...offboarded.filter((account) => account.slackUserId && !account.slackDeactivatedAt),
			...cancelled.filter((account) => account.lastError),
		].map((account) => ({
			_id: account._id,
			name: `${account.firstName} ${account.lastName}`.trim() || account.workspaceEmail,
			workspaceEmail: account.workspaceEmail,
			uioEmail: account.uioEmail,
			stage: account.stage,
			google: account.google,
			welcomeSent: account.welcomeSentAt !== undefined,
			slackLinked: account.slackUserId !== undefined,
			slackChannelsRemoved: account.slackChannelsRemoved,
			lastError: account.lastError,
			updatedAt: account.updatedAt,
		}));

		const drift = await ctx.db.query("accessDrift").take(MAX_ROWS);

		return {
			domain: workspaceDomain(),
			google: googleConfig() !== null,
			slack: slackConfig() !== null,
			slackInvite: slackInviteLink() !== undefined,
			accounts,
			drift: drift.map(({ _id, kind, email, name }) => ({ _id, kind, email, name })),
		};
	},
});
