"use node";

import { Resend } from "@convex-dev/resend";
import { pretty, render } from "@react-email/render";
import WorkspaceWelcomeEmail from "@workspace/emails/workspace-welcome-email";
import { INFO_EMAIL } from "@workspace/shared/constants/contact";
import { normalizeEmail } from "@workspace/shared/iam";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import {
	directoriesDisabled,
	googleConfig,
	isWorkspaceEmail,
	slackConfig,
	slackInviteLink,
	usesFakeDirectory,
	workspaceDomain,
} from "./config";
import { computeDrift, type DriftKind } from "./drift";
import { type GoogleUser, googleClient } from "./google";
import { runJob } from "./jobs";
import { type SlackMember, slackClient } from "./slack";

export const iamResend: Resend = new Resend(components.resend, { testMode: false });

const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_LENGTH = 16;

type Account = Doc<"memberAccounts"> & { inviterEmail?: string };

export function temporaryPassword() {
	return Array.from(
		crypto.getRandomValues(new Uint32Array(PASSWORD_LENGTH)),
		(value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length],
	).join("");
}

class UnconfirmedGoogleAccount extends Error {
	constructor(readonly owner: string) {
		super("unconfirmed");
	}
}

function unconfirmedMessage(account: Account, owner: string) {
	const holder = owner ? ` med navnet ${owner}` : "";
	return `${account.workspaceEmail} finnes allerede i Google Workspace${holder}. Bruk den bare hvis den tilhører ${account.firstName} ${account.lastName}.`;
}

function describe(error: unknown) {
	return error instanceof Error ? error.message : "Ukjent feil.";
}

function comparableName(name: string) {
	return name
		.normalize("NFKD")
		.replaceAll(/\p{M}/gu, "")
		.toLowerCase()
		.replaceAll(/\s+/g, " ")
		.trim();
}

export function belongsToSamePerson(existing: GoogleUser, account: Account) {
	return (
		comparableName(existing.name) === comparableName(`${account.firstName} ${account.lastName}`)
	);
}

async function loadAccount(
	ctx: ActionCtx,
	accountId: Id<"memberAccounts">,
): Promise<Account | null> {
	return await ctx.runQuery(internal.iam.internal.account, { accountId });
}

async function sendWelcome(ctx: ActionCtx, account: Account, password?: string) {
	if (!account.uioEmail) throw new Error("Mangler UiO-adresse å sende velkomstmeldingen til.");
	const html = await pretty(
		await render(
			WorkspaceWelcomeEmail({
				firstName: account.firstName,
				workspaceEmail: account.workspaceEmail,
				temporaryPassword: password,
				slackInviteLink: slackInviteLink(),
			}),
		),
	);
	if (usesFakeDirectory()) {
		console.log(`Local welcome email to ${account.uioEmail}, ${html.length} characters`);
		return;
	}
	await iamResend.sendEmail(ctx, {
		from: `Navet <${INFO_EMAIL}>`,
		replyTo: account.inviterEmail ? [account.inviterEmail] : undefined,
		to: account.uioEmail,
		subject: "Velkommen til Navet",
		html,
	});
}

function googleKey(account: Account) {
	return account.googleUserId ?? account.workspaceEmail;
}

async function rememberGoogleUser(
	ctx: ActionCtx,
	account: Account,
	user: GoogleUser,
	reactivated?: true,
) {
	await ctx.runMutation(internal.iam.internal.recordGoogleUser, {
		accountId: account._id,
		googleUserId: user.id,
		workspaceEmail: user.email,
		reactivated,
	});
}

async function ensureGoogleAccount(ctx: ActionCtx, account: Account) {
	const config = googleConfig();
	if (!config) throw new Error("Google Workspace er ikke koblet til ennå.");
	const google = googleClient(config);
	const password = temporaryPassword();
	const recoveryEmail = account.uioEmail;

	if (account.google === "created") {
		const found = await google.updateUser(googleKey(account), {
			password,
			suspended: false,
			recoveryEmail,
		});
		if (!found) throw new Error("Kontoen vi opprettet finnes ikke lenger i Google Workspace.");
		await rememberGoogleUser(ctx, account, found);
		return { state: "created" as const, password };
	}

	const result = await google.createUser({
		email: account.workspaceEmail,
		firstName: account.firstName,
		lastName: account.lastName,
		password,
		recoveryEmail,
	});
	if (result !== "exists") {
		await rememberGoogleUser(ctx, account, result);
		await ctx.runMutation(internal.iam.internal.recordProvisioned, {
			accountId: account._id,
			google: "created",
			welcomeSent: false,
		});
		return { state: "created" as const, password };
	}

	const existing = await google.getUser(googleKey(account));
	if (!existing)
		throw new Error(`Google sier at ${account.workspaceEmail} finnes, men fant den ikke.`);
	const inUseBySamePerson =
		existing.hasSignedIn && !existing.suspended && belongsToSamePerson(existing, account);
	const reactivating = account.googleConfirmed && existing.suspended;
	await rememberGoogleUser(ctx, account, existing, reactivating ? true : undefined);
	if (inUseBySamePerson) return { state: "existing" as const, password: undefined };
	if (!account.googleConfirmed) throw new UnconfirmedGoogleAccount(existing.name);
	if (existing.hasSignedIn) {
		if (existing.suspended)
			await google.updateUser(existing.id, { suspended: false, recoveryEmail });
		return { state: "existing" as const, password: undefined };
	}
	await google.updateUser(existing.id, { password, suspended: false, recoveryEmail });
	return { state: "existing" as const, password };
}

export const provision = internalAction({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		if (directoriesDisabled()) return;
		const account = await loadAccount(ctx, accountId);
		if (!account || account.welcomeSentAt) return;
		if (account.stage !== "onboarding" && account.stage !== "active") return;
		try {
			const { state, password } = await ensureGoogleAccount(ctx, account);
			const current = await loadAccount(ctx, accountId);
			if (current?.stage === "cancelled" && (state === "created" || current.googleReactivated)) {
				await runJob(ctx, "offboard", accountId);
				return;
			}
			if (current?.welcomeSentAt) return;
			if (current?.stage !== "onboarding" && current?.stage !== "active") return;
			await sendWelcome(ctx, current, password);
			await ctx.runMutation(internal.iam.internal.recordProvisioned, {
				accountId,
				google: state,
				welcomeSent: true,
			});
		} catch (error) {
			const unconfirmed = error instanceof UnconfirmedGoogleAccount;
			await ctx.runMutation(internal.iam.internal.recordFailure, {
				accountId,
				message: unconfirmed ? unconfirmedMessage(account, error.owner) : describe(error),
				googleOwner: unconfirmed ? error.owner : undefined,
			});
		}
	},
});

async function suspendGoogle(
	ctx: ActionCtx,
	account: Account,
): Promise<Doc<"memberAccounts">["google"]> {
	if (account.google === "suspended" || account.google === "not_applicable") return account.google;
	if (account.stage === "cancelled" && account.google !== "created" && !account.googleReactivated)
		return account.google;
	const config = googleConfig();
	if (!config) return account.google;
	if (!isWorkspaceEmail(account.workspaceEmail, config.domain)) return "not_applicable";
	const found = await googleClient(config).updateUser(googleKey(account), { suspended: true });
	if (!found) return "not_applicable";
	await rememberGoogleUser(ctx, account, found);
	return "suspended";
}

async function findSlackUser(account: Account) {
	const config = slackConfig();
	if (!config) return null;
	const slack = slackClient(config);
	if (account.slackUserId) return account.slackUserId;
	if (!isWorkspaceEmail(account.workspaceEmail, workspaceDomain())) return null;
	return slack.lookupByEmail(account.workspaceEmail);
}

export const offboard = internalAction({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		if (directoriesDisabled()) return;
		const account = await loadAccount(ctx, accountId);
		if (account?.stage !== "offboarding" && account?.stage !== "cancelled") return;
		const errors: string[] = [];

		let google = account.google;
		try {
			google = await suspendGoogle(ctx, account);
		} catch (error) {
			errors.push(describe(error));
		}

		let slackUserId = account.slackUserId;
		try {
			if (slackConfig()) slackUserId = (await findSlackUser(account)) ?? undefined;
		} catch (error) {
			errors.push(describe(error));
		}

		await ctx.runMutation(internal.iam.internal.recordOffboarded, {
			accountId,
			google,
			slackUserId,
			lastError: errors.length > 0 ? errors.join(" ") : undefined,
		});
	},
});

export const linkSlack = internalAction({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		if (directoriesDisabled()) return;
		const account = await loadAccount(ctx, accountId);
		if (!account || account.slackUserId) return;
		const slackUserId = await findSlackUser(account).catch(() => null);
		if (slackUserId) {
			await ctx.runMutation(internal.iam.internal.linkSlackUser, { accountId, slackUserId });
		}
	},
});

async function optional<T>(load: (() => Promise<T>) | null) {
	if (!load) return null;
	try {
		return await load();
	} catch (error) {
		console.error("IAM reconcile could not read directory", describe(error));
		return null;
	}
}

export const reconcile = internalAction({
	args: {},
	handler: async (ctx) => {
		if (directoriesDisabled()) return;
		const google = googleConfig();
		const slack = slackConfig();
		if (!google && !slack) return;

		await ctx.runMutation(internal.iam.internal.ensureAccounts, {});
		const directory = await ctx.runQuery(internal.iam.internal.directory, {});
		const [googleUsers, slackMembers] = await Promise.all([
			optional(google && (() => googleClient(google).listUsers())),
			optional(slack && (() => slackClient(slack).listMembers())),
		]);

		const reserved = new Set([
			...directory.positionEmails,
			...directory.ignoredEmails,
			...(google ? [google.adminEmail] : []),
		]);
		const googleLinks = matchGoogle(directory.googleCandidates, googleUsers);
		const drift = computeDrift(
			{
				memberEmails: new Set([
					...directory.internalEmails,
					...directory.accountEmails,
					...googleLinks.map((link) => link.workspaceEmail),
				]),
				internalWorkspaceEmails: new Set(
					directory.internalEmails.filter(
						(email) => isWorkspaceEmail(email, google?.domain ?? null) && !reserved.has(email),
					),
				),
				reservedEmails: reserved,
			},
			googleUsers,
			slackMembers,
		);

		const checkedKinds: DriftKind[] = [
			...(googleUsers ? (["google_without_member", "member_google_suspended"] as const) : []),
			...(slackMembers ? (["slack_without_member"] as const) : []),
		];
		const { slackLinks, slackDeactivated, slackStillActive } = matchSlack(
			directory.slackCandidates,
			slackMembers,
		);
		await ctx.runMutation(internal.iam.internal.applyReconcile, {
			drift,
			googleLinks,
			slackLinks,
			slackDeactivated,
			slackStillActive,
			checkedKinds,
		});
	},
});

type GoogleCandidate = Readonly<{
	accountId: Id<"memberAccounts">;
	workspaceEmail: string;
	googleUserId?: string;
}>;

export function matchGoogle(
	candidates: readonly GoogleCandidate[],
	users: readonly GoogleUser[] | null,
) {
	if (!users) return [];
	const byId = new Map(users.map((user) => [user.id, user]));
	const byEmail = new Map(users.map((user) => [user.email, user]));
	return candidates.flatMap((candidate) => {
		const user = candidate.googleUserId
			? byId.get(candidate.googleUserId)
			: byEmail.get(candidate.workspaceEmail);
		if (!user) return [];
		if (user.id === candidate.googleUserId && user.email === candidate.workspaceEmail) return [];
		return [{ accountId: candidate.accountId, googleUserId: user.id, workspaceEmail: user.email }];
	});
}

type SlackCandidate = Readonly<{
	accountId: Id<"memberAccounts">;
	stage: string;
	email: string;
	slackUserId?: string;
	markedDeactivated?: boolean;
}>;

export function matchSlack(
	candidates: readonly SlackCandidate[],
	members: readonly SlackMember[] | null,
) {
	const slackLinks: { accountId: Id<"memberAccounts">; slackUserId: string }[] = [];
	const slackDeactivated: Id<"memberAccounts">[] = [];
	const slackStillActive: Id<"memberAccounts">[] = [];
	if (!members) return { slackLinks, slackDeactivated, slackStillActive };
	const byId = new Map(members.map((member) => [member.id, member]));
	const byEmail = new Map(members.map((member) => [member.email, member]));
	for (const candidate of candidates) {
		const member = candidate.slackUserId
			? byId.get(candidate.slackUserId)
			: byEmail.get(normalizeEmail(candidate.email));
		if (!member) continue;
		if (!candidate.slackUserId)
			slackLinks.push({ accountId: candidate.accountId, slackUserId: member.id });
		if (
			candidate.stage !== "offboarded" ||
			member.deactivated === (candidate.markedDeactivated ?? false)
		)
			continue;
		(member.deactivated ? slackDeactivated : slackStillActive).push(candidate.accountId);
	}
	return { slackLinks, slackDeactivated, slackStillActive };
}
