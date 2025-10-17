import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel, typeof authSchema>(
	components.betterAuth,
	{
		local: {
			schema: authSchema,
		},
		verbose: true,
	},
);

export const createAuth = (
	ctx: GenericCtx<DataModel>,
	{ optionsOnly } = { optionsOnly: false },
) => {
	return betterAuth({
		logger: {
			disabled: optionsOnly,
		},
		baseURL: siteUrl,
		trustedOrigins: [
			"http://localhost:*",
			"https://ifinavet.no",
			"https://*.ifinavet.no",
		],
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		user: {
			additionalFields: {
				degree: {
					type: "string",
					required: false,
					defaultValue: "Bachelor",
				},
				semester: {
					type: "number",
					required: false,
					defaultValue: 1,
				},
				program: {
					type: "string",
					required: false,
					defaultValue: "Informatikk: Programmering og Systemarkitektur",
				},
			},
		},
		plugins: [admin(), organization(), convex()],
	});
};

export const currentUser = async (ctx: GenericCtx<DataModel>) =>
	authComponent.getAuthUser(ctx);

export const getCurrentUserOrThrow = async (ctx: GenericCtx<DataModel>) => {
	const user = await currentUser(ctx);
	if (!user) {
		throw new Error("User not found");
	}
	return user;
};

export const getCurrentUser = query({
	handler: async (ctx) => {
		return currentUser(ctx);
	},
});
