import { normalizeEmail } from "@workspace/shared/iam";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { isWorkspaceEmail, workspaceDomain } from "./config";
import { driftKinds, googleStates, isCurrentStage } from "./schema";

const MAX_DIRECTORY_ROWS = 2000;

export const account = internalQuery({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		const account = await ctx.db.get(accountId);
		if (!account) return null;
		const inviter = account.invitedBy ? await ctx.db.get(account.invitedBy) : null;
		return { ...account, inviterEmail: inviter?.email };
	},
});

export const recordProvisioned = internalMutation({
	args: {
		accountId: v.id("memberAccounts"),
		google: googleStates,
		welcomeSent: v.boolean(),
	},
	handler: async (ctx, { accountId, google, welcomeSent }) => {
		const account = await ctx.db.get(accountId);
		if (welcomeSent && account?.stage !== "onboarding" && account?.stage !== "active") return;
		const now = Date.now();
		await ctx.db.patch(accountId, {
			google,
			lastError: undefined,
			updatedAt: now,
			...(welcomeSent && { welcomeSentAt: now }),
		});
	},
});

export const recordOffboarded = internalMutation({
	args: {
		accountId: v.id("memberAccounts"),
		google: googleStates,
		slackUserId: v.optional(v.string()),
		lastError: v.optional(v.string()),
	},
	handler: async (ctx, { accountId, lastError, ...fields }) => {
		const account = await ctx.db.get(accountId);
		if (account?.stage !== "offboarding" && account?.stage !== "cancelled") return;
		await ctx.db.patch(accountId, {
			...fields,
			lastError,
			stage: account.stage === "offboarding" && !lastError ? "offboarded" : account.stage,
			updatedAt: Date.now(),
		});
	},
});

export const recordFailure = internalMutation({
	args: {
		accountId: v.id("memberAccounts"),
		message: v.string(),
		googleOwner: v.optional(v.string()),
	},
	handler: async (ctx, { accountId, message, googleOwner }) => {
		await ctx.db.patch(accountId, { lastError: message, googleOwner, updatedAt: Date.now() });
	},
});

export const recordGoogleUser = internalMutation({
	args: {
		accountId: v.id("memberAccounts"),
		googleUserId: v.string(),
		workspaceEmail: v.string(),
		reactivated: v.optional(v.literal(true)),
	},
	handler: async (ctx, { accountId, googleUserId, workspaceEmail, reactivated }) => {
		const account = await ctx.db.get(accountId);
		if (!account) return;
		const unchanged =
			account.googleUserId === googleUserId &&
			account.workspaceEmail === workspaceEmail &&
			(!reactivated || account.googleReactivated);
		if (unchanged) return;
		await ctx.db.patch(accountId, {
			googleUserId,
			workspaceEmail,
			updatedAt: Date.now(),
			...(reactivated && { googleReactivated: true }),
		});
	},
});

export const linkSlackUser = internalMutation({
	args: { accountId: v.id("memberAccounts"), slackUserId: v.string() },
	handler: async (ctx, { accountId, slackUserId }) => {
		await ctx.db.patch(accountId, { slackUserId, updatedAt: Date.now() });
	},
});

export const directory = internalQuery({
	args: {},
	handler: async (ctx) => {
		const internals = await ctx.db.query("internals").take(MAX_DIRECTORY_ROWS);
		const users = await Promise.all(internals.map((member) => ctx.db.get(member.userId)));
		const accounts = await ctx.db.query("memberAccounts").take(MAX_DIRECTORY_ROWS);
		const ignored = await ctx.db.query("accessDriftIgnores").take(MAX_DIRECTORY_ROWS);

		const internalEmails = users.flatMap((user) =>
			user?.email ? [normalizeEmail(user.email)] : [],
		);
		const current = accounts.filter((a) => isCurrentStage(a.stage));
		return {
			internalEmails,
			accountEmails: current.flatMap((a) => [
				a.workspaceEmail,
				...(a.uioEmail ? [a.uioEmail] : []),
			]),
			positionEmails: internals.flatMap((m) =>
				m.positionEmail ? [normalizeEmail(m.positionEmail)] : [],
			),
			ignoredEmails: ignored.map((row) => row.email),
			googleCandidates: accounts
				.filter((a) => a.stage !== "cancelled" && a.google !== "not_applicable")
				.map((a) => ({
					accountId: a._id,
					workspaceEmail: a.workspaceEmail,
					googleUserId: a.googleUserId,
				})),
			slackCandidates: accounts
				.filter((a) => a.stage === "active" || a.stage === "offboarded")
				.filter((a) => a.stage === "offboarded" || !a.slackUserId)
				.filter((a) => a.slackUserId || isWorkspaceEmail(a.workspaceEmail, workspaceDomain()))
				.map((a) => ({
					accountId: a._id,
					stage: a.stage,
					email: a.workspaceEmail,
					slackUserId: a.slackUserId,
					markedDeactivated: a.slackDeactivatedAt !== undefined,
				})),
		};
	},
});

export const applyReconcile = internalMutation({
	args: {
		drift: v.array(v.object({ kind: driftKinds, email: v.string(), name: v.optional(v.string()) })),
		googleLinks: v.array(
			v.object({
				accountId: v.id("memberAccounts"),
				googleUserId: v.string(),
				workspaceEmail: v.string(),
			}),
		),
		slackLinks: v.array(v.object({ accountId: v.id("memberAccounts"), slackUserId: v.string() })),
		slackDeactivated: v.array(v.id("memberAccounts")),
		slackStillActive: v.array(v.id("memberAccounts")),
		checkedKinds: v.array(driftKinds),
	},
	handler: async (
		ctx,
		{ drift, googleLinks, slackLinks, slackDeactivated, slackStillActive, checkedKinds },
	) => {
		const now = Date.now();
		const stale = await ctx.db.query("accessDrift").take(MAX_DIRECTORY_ROWS);
		await Promise.all(
			stale.filter((row) => checkedKinds.includes(row.kind)).map((row) => ctx.db.delete(row._id)),
		);
		await Promise.all(
			drift.map((row) => ctx.db.insert("accessDrift", { ...row, detectedAt: now })),
		);
		await Promise.all(
			googleLinks.map(({ accountId, ...fields }) =>
				ctx.db.patch(accountId, { ...fields, updatedAt: now }),
			),
		);
		await Promise.all(
			slackLinks.map(({ accountId, slackUserId }) =>
				ctx.db.patch(accountId, { slackUserId, updatedAt: now }),
			),
		);
		await Promise.all(
			slackDeactivated.map((accountId) =>
				ctx.db.patch(accountId, { slackDeactivatedAt: now, updatedAt: now }),
			),
		);
		await Promise.all(
			slackStillActive.map((accountId) =>
				ctx.db.patch(accountId, { slackDeactivatedAt: undefined, updatedAt: now }),
			),
		);
	},
});
