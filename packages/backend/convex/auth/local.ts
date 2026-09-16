import { mutation } from "../_generated/server";

// Convex supplies this deployment URL; never enable mock auth on a hosted backend.
export function isLocalDevelopment() {
	return /^http:\/\/(127\.0\.0\.1|localhost):3210$/.test(process.env.CONVEX_CLOUD_URL ?? "");
}

export const localIdentity = {
	subject: "local-developer",
	givenName: "Local",
	familyName: "Developer",
	email: "developer@example.test",
	profileUrl: "",
};

export const signIn = mutation({
	args: {},
	handler: async (ctx) => {
		if (!isLocalDevelopment()) return null;
		const existing = await ctx.db
			.query("users")
			.withIndex("by_ExternalId", (q) => q.eq("externalId", localIdentity.subject))
			.unique();
		if (existing) return existing._id;
		const userId = await ctx.db.insert("users", {
			externalId: localIdentity.subject,
			firstName: localIdentity.givenName,
			lastName: localIdentity.familyName,
			email: localIdentity.email,
			image: "",
			locked: false,
		});
		await ctx.db.insert("students", {
			userId,
			name: "Local Developer",
			studyProgram: "Informatikk: programmering og systemarkitektur",
			year: 1,
			degree: "Bachelor",
		});
		await ctx.db.insert("accessRights", { userId, role: "super-admin" });
		return userId;
	},
});
