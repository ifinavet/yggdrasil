import { localIdentity } from "@workspace/shared/local";
import { mutation } from "../_generated/server";

// Convex supplies this deployment URL; never enable mock auth on a hosted backend.
export function isLocalDevelopment() {
	return /^http:\/\/(127\.0\.0\.1|localhost):3210$/.test(process.env.CONVEX_CLOUD_URL ?? "");
}

export { localIdentity };

export const signIn = mutation({
	args: {},
	handler: async (ctx) => {
		if (!isLocalDevelopment()) return null;
		const existing = await ctx.db
			.query("users")
			.withIndex("by_ExternalId", (q) => q.eq("externalId", localIdentity.subject))
			.unique();
		const userId =
			existing?._id ??
			(await ctx.db.insert("users", {
				externalId: localIdentity.subject,
				firstName: localIdentity.givenName,
				lastName: localIdentity.familyName,
				email: localIdentity.email,
				image: "",
				locked: false,
			}));

		const student = await ctx.db
			.query("students")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();
		if (!student) {
			await ctx.db.insert("students", {
				userId,
				name: "Local Developer",
				studyProgram: "Informatikk: programmering og systemarkitektur",
				year: 1,
				degree: "Bachelor",
			});
		}

		const rights = await ctx.db
			.query("accessRights")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();
		if (!rights) {
			await ctx.db.insert("accessRights", { userId, role: "super-admin" });
		}

		return userId;
	},
});
