import { isUioEmail } from "@workspace/shared/iam";
import { hasSearchWords, matchesSearch } from "@workspace/shared/utils";
import { v } from "convex/values";
import { asyncMap } from "convex-helpers";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { googleConfig, slackConfig, slackInviteLink, workspaceDomain } from "./config";
import { isCurrentStage } from "./schema";

const MAX_ROWS = 200;
const SEARCH_CANDIDATES = 20;
const SEARCH_RESULTS = 8;

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
			lastError: account.lastError,
			googleOwner: account.googleOwner,
			updatedAt: account.updatedAt,
		}));

		const detected = await ctx.db.query("accessDrift").take(MAX_ROWS);
		const resolved = await asyncMap(detected, async (row) => {
			if (row.kind === "member_google_suspended") return false;
			const owners = await ctx.db
				.query("memberAccounts")
				.withIndex("by_workspaceEmail", (q) => q.eq("workspaceEmail", row.email))
				.take(10);
			return owners.some((account) => isCurrentStage(account.stage));
		});
		const drift = detected.filter((_, index) => !resolved[index]);

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

export const searchUioUsers = query({
	args: { query: v.string() },
	handler: async (ctx, args) => {
		await requireRole(ctx, adminRoles);

		if (!hasSearchWords(args.query)) return [];
		const text = args.query.trim();

		const candidates = await Promise.all(
			(["email", "firstName", "lastName"] as const).map((field) =>
				ctx.db
					.query("users")
					.withSearchIndex(`search_${field}`, (q) => q.search(field, text))
					.take(SEARCH_CANDIDATES),
			),
		);

		const unique = new Map(candidates.flat().map((user) => [user._id, user]));
		return [...unique.values()]
			.filter((user) => isUioEmail(user.email))
			.filter((user) => matchesSearch([user.firstName, user.lastName, user.email], args.query))
			.slice(0, SEARCH_RESULTS)
			.map(({ _id, email, firstName, lastName }) => ({ userId: _id, email, firstName, lastName }));
	},
});
