import { normalizeEmail } from "@workspace/shared/iam";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assignAccessRole, getAssignedAccessRole } from "../auth/accessRights";
import { accountForEmail, accountForUser } from "./accounts";
import { runJob } from "./jobs";

export async function usersWithEmail(ctx: QueryCtx, emails: readonly string[]) {
	const users = await Promise.all(
		emails.map((email) =>
			ctx.db
				.query("users")
				.withIndex("by_email", (q) => q.eq("email", email))
				.collect(),
		),
	);
	return users.flat();
}

async function makeInternal(ctx: MutationCtx, userId: Id<"users">, group: string) {
	const existing = await ctx.db
		.query("internals")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.first();
	if (!existing) await ctx.db.insert("internals", { userId, group, position: "Intern" });
	if ((await getAssignedAccessRole(ctx, userId)) === null)
		await assignAccessRole(ctx, userId, "internal");
}

export async function activate(
	ctx: MutationCtx,
	account: Doc<"memberAccounts">,
	userId: Id<"users">,
) {
	await makeInternal(ctx, userId, account.group);
	await ctx.db.patch(account._id, { stage: "active", userId, updatedAt: Date.now() });
	await ctx.scheduler.runAfter(0, internal.iam.actions.linkSlack, { accountId: account._id });
}

export async function activateOnSignIn(ctx: MutationCtx, user: Doc<"users">) {
	if (!user.email) return;
	const account = await accountForEmail(ctx, user.email);
	if (account?.stage !== "onboarding") return;
	await activate(ctx, account, user._id);
}

export async function startOffboarding(
	ctx: MutationCtx,
	internalMember: Doc<"internals">,
	user: Doc<"users"> | null,
) {
	const email = normalizeEmail(user?.email ?? "");
	const existing = await accountForUser(ctx, internalMember.userId, email);
	const now = Date.now();

	if (existing) {
		await ctx.db.patch(existing._id, {
			stage: "offboarding",
			userId: internalMember.userId,
			lastError: undefined,
			updatedAt: now,
		});
		await runJob(ctx, "offboard", existing._id);
		return;
	}

	if (!email) return;
	const accountId = await ctx.db.insert("memberAccounts", {
		workspaceEmail: email,
		firstName: user?.firstName ?? "",
		lastName: user?.lastName ?? "",
		group: internalMember.group,
		stage: "offboarding",
		google: "pending",
		userId: internalMember.userId,
		updatedAt: now,
	});
	await runJob(ctx, "offboard", accountId);
}
