"use node";

import { Resend } from "@convex-dev/resend";
import { pretty, render } from "@react-email/render";
import WorkspaceWelcomeEmail from "@workspace/emails/workspace-welcome-email";
import { normalizeEmail } from "@workspace/shared/iam";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { isLocalDevelopment } from "../auth/local";
import { googleConfig, isWorkspaceEmail, slackConfig, slackInviteLink } from "./config";
import { computeDrift, type DriftKind } from "./drift";
import { type GoogleUser, googleClient } from "./google";
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
	return ctx.runQuery(internal.iam.internal.account, { accountId });
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
	await iamResend.sendEmail(ctx, {
		from: "Navet <info@ifinavet.no>",
		replyTo: account.inviterEmail ? [account.inviterEmail] : undefined,
		to: account.uioEmail,
		subject: "Velkommen til Navet",
		html,
	});
}

async function ensureGoogleAccount(ctx: ActionCtx, account: Account) {
	const config = googleConfig();
	if (!config) throw new Error("Google Workspace er ikke koblet til ennå.");
	const google = googleClient(config);
	const password = temporaryPassword();

	if (account.google === "created") {
		const found = await google.updateUser(account.workspaceEmail, { password, suspended: false });
		if (!found) throw new Error("Kontoen vi opprettet finnes ikke lenger i Google Workspace.");
		return { state: "created" as const, password };
	}

	const result = await google.createUser({
		email: account.workspaceEmail,
		firstName: account.firstName,
		lastName: account.lastName,
		password,
	});
	if (result === "created") {
		await ctx.runMutation(internal.iam.internal.recordProvisioned, {
			accountId: account._id,
			google: "created",
			welcomeSent: false,
		});
		return { state: "created" as const, password };
	}

	const existing = await google.getUser(account.workspaceEmail);
	if (!existing)
		throw new Error(`Google sier at ${account.workspaceEmail} finnes, men fant den ikke.`);
	const inUseBySamePerson =
		existing.hasSignedIn && !existing.suspended && belongsToSamePerson(existing, account);
	if (inUseBySamePerson) return { state: "existing" as const, password: undefined };
	if (!account.googleConfirmed) throw new UnconfirmedGoogleAccount(existing.name);
	if (existing.hasSignedIn) {
		if (existing.suspended) await google.updateUser(account.workspaceEmail, { suspended: false });
		return { state: "existing" as const, password: undefined };
	}
	await google.updateUser(account.workspaceEmail, { password, suspended: false });
	return { state: "existing" as const, password };
}

export const provision = internalAction({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		if (isLocalDevelopment()) return;
		const account = await loadAccount(ctx, accountId);
		if (!account || account.welcomeSentAt) return;
		if (account.stage !== "onboarding" && account.stage !== "active") return;
		try {
			const { state, password } = await ensureGoogleAccount(ctx, account);
			const current = await loadAccount(ctx, accountId);
			if (current?.stage === "cancelled" && state === "created") {
				await ctx.scheduler.runAfter(0, internal.iam.actions.offboard, { accountId });
				return;
			}
			if (current?.welcomeSentAt) return;
			if (current?.stage !== "onboarding" && current?.stage !== "active") return;
			await sendWelcome(ctx, account, password);
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

async function suspendGoogle(account: Account): Promise<Doc<"memberAccounts">["google"]> {
	if (account.google === "suspended" || account.google === "not_applicable") return account.google;
	if (account.stage === "cancelled" && account.google !== "created") return account.google;
	const config = googleConfig();
	if (!config) throw new Error("Google Workspace er ikke koblet til ennå.");
	if (!isWorkspaceEmail(account.workspaceEmail, config.domain)) return "not_applicable";
	const found = await googleClient(config).updateUser(account.workspaceEmail, { suspended: true });
	return found ? "suspended" : "not_applicable";
}

async function findSlackUser(account: Account) {
	const config = slackConfig();
	if (!config) return null;
	const slack = slackClient(config);
	if (account.slackUserId) return account.slackUserId;
	return (
		(await slack.lookupByEmail(account.workspaceEmail)) ??
		(account.uioEmail ? await slack.lookupByEmail(account.uioEmail) : null)
	);
}

async function removeFromSlackChannels(slackUserId: string) {
	const config = slackConfig();
	if (!config) throw new Error("Slack er ikke koblet til ennå.");
	const slack = slackClient(config);
	let removed = 0;
	let failed = 0;
	for (const channel of await slack.channelsOf(slackUserId)) {
		const result = await slack.kick(channel, slackUserId).catch(() => "failed" as const);
		if (result === "removed") removed++;
		if (result === "failed") failed++;
	}
	const channels = failed === 1 ? "kanal" : "kanaler";
	const error =
		failed > 0
			? `Fikk ikke fjernet personen fra ${failed} Slack-${channels}. Legg til Navet-appen i kanalene og prøv igjen.`
			: undefined;
	return { removed, error };
}

export const offboard = internalAction({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		if (isLocalDevelopment()) return;
		const account = await loadAccount(ctx, accountId);
		if (account?.stage !== "offboarding" && account?.stage !== "cancelled") return;
		const errors: string[] = [];

		let google = account.google;
		try {
			google = await suspendGoogle(account);
		} catch (error) {
			errors.push(describe(error));
		}

		let slackUserId = account.slackUserId;
		let slackChannelsRemoved = 0;
		try {
			if (!slackConfig()) throw new Error("Slack er ikke koblet til ennå.");
			slackUserId = (await findSlackUser(account)) ?? undefined;
			if (slackUserId) {
				const { removed, error } = await removeFromSlackChannels(slackUserId);
				slackChannelsRemoved = removed;
				if (error) errors.push(error);
			}
		} catch (error) {
			errors.push(describe(error));
		}

		await ctx.runMutation(internal.iam.internal.recordOffboarded, {
			accountId,
			google,
			slackUserId,
			slackChannelsRemoved,
			lastError: errors.length > 0 ? errors.join(" ") : undefined,
		});
	},
});

export const linkSlack = internalAction({
	args: { accountId: v.id("memberAccounts") },
	handler: async (ctx, { accountId }) => {
		if (isLocalDevelopment()) return;
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
		if (isLocalDevelopment()) return;
		const google = googleConfig();
		const slack = slackConfig();
		if (!google && !slack) return;

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
		const drift = computeDrift(
			{
				memberEmails: new Set([...directory.internalEmails, ...directory.accountEmails]),
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
		const { slackLinks, slackDeactivated } = matchSlack(directory.slackCandidates, slackMembers);
		await ctx.runMutation(internal.iam.internal.applyReconcile, {
			drift,
			slackLinks,
			slackDeactivated,
			checkedKinds,
		});
	},
});

type SlackCandidate = Readonly<{
	accountId: Id<"memberAccounts">;
	stage: string;
	email: string;
	slackUserId?: string;
}>;

export function matchSlack(
	candidates: readonly SlackCandidate[],
	members: readonly SlackMember[] | null,
) {
	const slackLinks: { accountId: Id<"memberAccounts">; slackUserId: string }[] = [];
	const slackDeactivated: Id<"memberAccounts">[] = [];
	if (!members) return { slackLinks, slackDeactivated };
	const byId = new Map(members.map((member) => [member.id, member]));
	const byEmail = new Map(members.map((member) => [member.email, member]));
	for (const candidate of candidates) {
		const member = candidate.slackUserId
			? byId.get(candidate.slackUserId)
			: byEmail.get(normalizeEmail(candidate.email));
		if (!member) continue;
		if (!candidate.slackUserId)
			slackLinks.push({ accountId: candidate.accountId, slackUserId: member.id });
		if (candidate.stage === "offboarded" && member.deactivated)
			slackDeactivated.push(candidate.accountId);
	}
	return { slackLinks, slackDeactivated };
}
