import { onboardingSchema } from "@workspace/shared/iam";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { type MutationCtx, mutation } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { workspaceDomain } from "./config";
import { accountForEmail, activate, usersWithEmail } from "./lifecycle";

async function requireAccount(ctx: MutationCtx, accountId: Doc<"memberAccounts">["_id"]) {
	const account = await ctx.db.get(accountId);
	if (!account) throw new ConvexError("Fant ikke kontoen.");
	return account;
}

async function refuseDuplicates(ctx: MutationCtx, emails: readonly string[]) {
	const accounts = await Promise.all(emails.map((email) => accountForEmail(ctx, email)));
	const current = accounts.find(
		(account) => account && account.stage !== "offboarded" && account.stage !== "cancelled",
	);
	if (current?.stage === "offboarding") {
		throw new ConvexError(`${current.firstName} blir fjernet akkurat nå. Prøv igjen om litt.`);
	}
	if (current) throw new ConvexError(`${current.workspaceEmail} er allerede lagt til.`);

	for (const user of await usersWithEmail(ctx, emails)) {
		const internalMember = await ctx.db
			.query("internals")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.first();
		if (internalMember) throw new ConvexError(`${user.email} er allerede internt medlem.`);
	}

	const [byWorkspace, byUio] = accounts;
	if (byWorkspace && byUio && byWorkspace._id !== byUio._id) {
		throw new ConvexError(
			`${byWorkspace.workspaceEmail} og ${byUio.uioEmail} hører til to forskjellige tidligere medlemmer. Sjekk adressene.`,
		);
	}
	return byWorkspace ?? byUio ?? null;
}

export const startOnboarding = mutation({
	args: {
		firstName: v.string(),
		lastName: v.string(),
		uioEmail: v.string(),
		workspaceEmail: v.string(),
		group: v.string(),
	},
	handler: async (ctx, args) => {
		const caller = await requireRole(ctx, adminRoles);
		const parsed = onboardingSchema(workspaceDomain()).safeParse(args);
		if (!parsed.success)
			throw new ConvexError(parsed.error.issues[0]?.message ?? "Ugyldig skjema.");
		const input = parsed.data;
		const emails = [input.workspaceEmail, input.uioEmail];

		const previous = await refuseDuplicates(ctx, emails);
		const fields = {
			...input,
			stage: "onboarding" as const,
			google: "pending" as const,
			invitedBy: caller._id,
			updatedAt: Date.now(),
		};
		if (previous) await ctx.db.replace(previous._id, fields);
		const accountId = previous?._id ?? (await ctx.db.insert("memberAccounts", fields));

		const [existingUser] = await usersWithEmail(ctx, emails);
		const account = await requireAccount(ctx, accountId);
		if (existingUser) await activate(ctx, account, existingUser._id);

		await ctx.scheduler.runAfter(0, internal.iam.actions.provision, { accountId });
		return { accountId, activated: existingUser !== undefined };
	},
});

export const retry = mutation({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		await requireRole(ctx, adminRoles);
		const account = await requireAccount(ctx, accountId);
		const provisioning =
			(account.stage === "onboarding" || account.stage === "active") && !account.welcomeSentAt;
		const offboarding = account.stage === "offboarding" || account.stage === "cancelled";
		if (!provisioning && !offboarding) throw new ConvexError("Det er ingenting å prøve på nytt.");
		if (!account.lastError) throw new ConvexError("Dette kjører allerede. Vent litt.");

		await ctx.db.patch(accountId, { lastError: undefined, updatedAt: Date.now() });
		await ctx.scheduler.runAfter(
			0,
			provisioning ? internal.iam.actions.provision : internal.iam.actions.offboard,
			{ accountId },
		);
	},
});

export const cancelOnboarding = mutation({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		await requireRole(ctx, adminRoles);
		const account = await requireAccount(ctx, accountId);
		if (account.stage !== "onboarding") {
			throw new ConvexError(
				"Personen har allerede logget inn. Fjern dem fra listen over interne i stedet.",
			);
		}
		await ctx.db.patch(accountId, {
			stage: "cancelled",
			lastError: undefined,
			updatedAt: Date.now(),
		});
		if (account.google === "created") {
			await ctx.scheduler.runAfter(0, internal.iam.actions.offboard, { accountId });
		}
	},
});

export const markSlackDeactivated = mutation({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		await requireRole(ctx, adminRoles);
		const account = await requireAccount(ctx, accountId);
		if (account.stage !== "offboarding" && account.stage !== "offboarded") {
			throw new ConvexError("Personen er ikke under fjerning.");
		}
		await ctx.db.patch(accountId, { slackDeactivatedAt: Date.now(), updatedAt: Date.now() });
	},
});

export const ignoreDrift = mutation({
	args: { email: v.string() },
	handler: async (ctx, { email }) => {
		const caller = await requireRole(ctx, adminRoles);
		const alreadyIgnored = await ctx.db
			.query("accessDriftIgnores")
			.withIndex("by_email", (q) => q.eq("email", email))
			.first();
		if (!alreadyIgnored)
			await ctx.db.insert("accessDriftIgnores", { email, ignoredBy: caller._id });

		const rows = await ctx.db
			.query("accessDrift")
			.withIndex("by_email", (q) => q.eq("email", email))
			.collect();
		await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
	},
});
