import { domainOf, normalizeEmail } from "@workspace/shared/iam";

export type GoogleConfig = Readonly<{
	serviceAccountEmail: string;
	privateKey: string;
	adminEmail: string;
	domain: string;
}>;

export type SlackConfig = Readonly<{ botToken: string }>;

export function googleConfig(): GoogleConfig | null {
	const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL;
	if (!serviceAccountEmail || !privateKey || !adminEmail) return null;
	return {
		serviceAccountEmail,
		privateKey: privateKey.replaceAll(String.raw`\n`, "\n"),
		adminEmail: normalizeEmail(adminEmail),
		domain: domainOf(adminEmail),
	};
}

export function workspaceDomain() {
	const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL;
	return adminEmail ? domainOf(adminEmail) : null;
}

export function slackConfig(): SlackConfig | null {
	const botToken = process.env.SLACK_BOT_TOKEN;
	return botToken ? { botToken } : null;
}

export function slackInviteLink() {
	return process.env.SLACK_INVITE_LINK || undefined;
}

export function isWorkspaceEmail(email: string, domain: string | null) {
	return domain !== null && domainOf(email) === domain;
}
