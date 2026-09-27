import { normalizeEmail } from "@workspace/shared/iam";
import type { QueryCtx } from "../_generated/server";

export async function accountForEmail(ctx: QueryCtx, email: string) {
	const normalized = normalizeEmail(email);
	return (
		(await ctx.db
			.query("memberAccounts")
			.withIndex("by_workspaceEmail", (q) => q.eq("workspaceEmail", normalized))
			.first()) ??
		(await ctx.db
			.query("memberAccounts")
			.withIndex("by_uioEmail", (q) => q.eq("uioEmail", normalized))
			.first())
	);
}
