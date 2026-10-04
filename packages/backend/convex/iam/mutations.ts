import { domainOf, normalizeEmail, onboardingSchema, uioEmailSchema } from "@workspace/shared/iam";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { type MutationCtx, mutation } from "../_generated/server";
import {
	adminRoles,
	requireRightToManageRole,
	requireRole,
	userHasRole,
} from "../auth/accessRights";
import { accountForEmail, accountForUser } from "./accounts";
import { workspaceDomain } from "./config";
import { runJob } from "./jobs";
import { activate, usersWithEmail } from "./lifecycle";

async function requireAccount(ctx: MutationCtx, accountId: Doc<"memberAccounts">["_id"]) {
	const account = await ctx.db.get(accountId);
	if (!account) throw new ConvexError("Fant ikke kontoen.");
	return account;
}

function isProvisioning(account: Doc<"memberAccounts">) {
	return (account.stage === "onboarding" || account.stage === "active") && !account.welcomeSentAt;
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

async function startOnboardingForCaller(
	ctx: MutationCtx,
	caller: Doc<"users">,
	input: {
		firstName: string;
		lastName: string;
		uioEmail: string;
		workspaceEmail: string;
		group: string;
	},
) {
	const emails = [input.workspaceEmail, input.uioEmail];
	const previous = await refuseDuplicates(ctx, emails);
	const [existingUser] = await usersWithEmail(ctx, emails);
	if (existingUser) await requireRightToManageRole(ctx, existingUser._id);
	const sameAddress = previous?.workspaceEmail === input.workspaceEmail;
	const fields = {
		...input,
		...(sameAddress && { googleUserId: previous.googleUserId, slackUserId: previous.slackUserId }),
		stage: "onboarding" as const,
		google: "pending" as const,
		invitedBy: caller._id,
		updatedAt: Date.now(),
	};
	if (previous) await ctx.db.replace(previous._id, fields);
	const accountId = previous?._id ?? (await ctx.db.insert("memberAccounts", fields));
	const account = await requireAccount(ctx, accountId);
	if (existingUser) await activate(ctx, account, existingUser._id);
	await runJob(ctx, "provision", accountId);
	return { accountId, activated: existingUser !== undefined };
}

export async function startAcceptedAdmissionOnboarding(
	ctx: MutationCtx,
	applicationId: Doc<"admissionApplications">["_id"],
) {
	const application = await ctx.db.get(applicationId);
	if (
		application?.decision !== "accepted" ||
		application.offerStatus !== "accepted" ||
		!application.reviewedGroup ||
		!application.reviewedWorkspaceEmail ||
		!application.decisionBy
	) {
		throw new ConvexError("Tilbudet er ikke godkjent av søkeren.");
	}
	if (application.onboardingStartedAt) return null;
	if (!(await userHasRole(ctx, application.decisionBy, adminRoles)))
		throw new ConvexError("Administratorgodkjenningen er ikke lenger gyldig.");
	const approvingAdmin = await ctx.db.get(application.decisionBy);
	if (!approvingAdmin) throw new ConvexError("Fant ikke administratoren som godkjente opptaket.");
	const user = await ctx.db.get(application.userId);
	if (!user?.email) throw new ConvexError("Søkerens e-postadresse mangler.");
	const parsed = onboardingSchema(workspaceDomain()).safeParse({
		firstName: user.firstName,
		lastName: user.lastName,
		uioEmail: normalizeEmail(user.email),
		workspaceEmail: application.reviewedWorkspaceEmail,
		group: application.reviewedGroup,
	});
	if (!parsed.success) throw new ConvexError(parsed.error.issues[0]?.message ?? "Ugyldig tilbud.");
	const result = await startOnboardingForCaller(ctx, approvingAdmin, parsed.data);
	await ctx.db.patch(applicationId, { onboardingStartedAt: Date.now() });
	return result;
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
		return startOnboardingForCaller(ctx, caller, parsed.data);
	},
});

function isFormer(account: Doc<"memberAccounts">) {
	return account.stage === "offboarded" || account.stage === "cancelled";
}

export const addUioEmail = mutation({
	args: { internalId: v.id("internals"), uioEmail: v.string() },
	handler: async (ctx, args) => {
		await requireRole(ctx, adminRoles);
		const parsed = uioEmailSchema.safeParse(args.uioEmail);
		if (!parsed.success)
			throw new ConvexError(parsed.error.issues[0]?.message ?? "Ugyldig adresse.");
		const uioEmail = parsed.data;

		const internalMember = await ctx.db.get(args.internalId);
		if (!internalMember) throw new ConvexError("Fant ikke det interne medlemmet.");
		const user = await ctx.db.get(internalMember.userId);
		if (!user?.email) throw new ConvexError("Medlemmet har ingen e-postadresse i Bifrost.");
		const workspaceEmail = normalizeEmail(user.email);

		const own = await accountForUser(ctx, user._id, workspaceEmail);
		const taken = await accountForEmail(ctx, uioEmail);
		if (taken && taken._id !== own?._id && !isFormer(taken))
			throw new ConvexError(`${uioEmail} hører allerede til ${taken.firstName} ${taken.lastName}.`);
		for (const other of await usersWithEmail(ctx, [uioEmail])) {
			const otherInternal = await ctx.db
				.query("internals")
				.withIndex("by_userId", (q) => q.eq("userId", other._id))
				.first();
			if (otherInternal) throw new ConvexError(`${uioEmail} er allerede internt medlem.`);
		}

		const updatedAt = Date.now();
		if (taken && taken._id !== own?._id)
			await ctx.db.patch(taken._id, { uioEmail: undefined, updatedAt });

		if (own && !isFormer(own)) {
			await ctx.db.patch(own._id, { uioEmail, userId: user._id, updatedAt });
			await ctx.scheduler.runAfter(0, internal.iam.actions.linkSlack, { accountId: own._id });
			return;
		}
		const fields = {
			workspaceEmail,
			uioEmail,
			firstName: user.firstName,
			lastName: user.lastName,
			group: internalMember.group,
			stage: "active" as const,
			google:
				domainOf(workspaceEmail) === workspaceDomain()
					? ("existing" as const)
					: ("not_applicable" as const),
			googleUserId: own?.googleUserId,
			slackUserId: own?.slackUserId,
			userId: user._id,
			updatedAt,
		};
		if (own) await ctx.db.replace(own._id, fields);
		const accountId = own?._id ?? (await ctx.db.insert("memberAccounts", fields));
		await ctx.scheduler.runAfter(0, internal.iam.actions.linkSlack, { accountId });
	},
});

export const retry = mutation({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		await requireRole(ctx, adminRoles);
		const account = await requireAccount(ctx, accountId);
		const provisioning = isProvisioning(account);
		const offboarding = account.stage === "offboarding" || account.stage === "cancelled";
		if (!provisioning && !offboarding) throw new ConvexError("Det er ingenting å prøve på nytt.");
		if (!account.lastError) throw new ConvexError("Dette kjører allerede. Vent litt.");

		await ctx.db.patch(accountId, { lastError: undefined, updatedAt: Date.now() });
		await runJob(ctx, provisioning ? "provision" : "offboard", accountId);
	},
});

export const confirmGoogleAccount = mutation({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		await requireRole(ctx, adminRoles);
		const account = await requireAccount(ctx, accountId);
		if (!isProvisioning(account) || account.googleOwner === undefined) {
			throw new ConvexError("Det er ingen eksisterende Google-konto å bekrefte.");
		}
		await ctx.db.patch(accountId, {
			googleConfirmed: true,
			googleOwner: undefined,
			lastError: undefined,
			updatedAt: Date.now(),
		});
		await runJob(ctx, "provision", accountId);
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
		if (account.google === "created" || account.googleReactivated) {
			await runJob(ctx, "offboard", accountId);
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

export const checkNow = mutation({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);
		await ctx.scheduler.runAfter(0, internal.iam.actions.reconcile, {});
	},
});

export const ignoreDrift = mutation({
	args: { email: v.string() },
	handler: async (ctx, args) => {
		const caller = await requireRole(ctx, adminRoles);
		const email = normalizeEmail(args.email);
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
