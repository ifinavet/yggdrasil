import type { EmailId } from "@convex-dev/resend";
import { exportPKCS8, generateKeyPair } from "jose";
import { vi } from "vitest";
import { iamResend } from "../convex/iam/actions";
import { createFakeDirectory } from "./fakeDirectory";

export const DOMAIN = "ifinavet.no";
export const ADMIN_EMAIL = `admin@${DOMAIN}`;

const FAKED_HOSTS = new Set(["oauth2.googleapis.com", "admin.googleapis.com", "slack.com"]);

const privateKey = generateKeyPair("RS256", { extractable: true }).then(({ privateKey }) =>
	exportPKCS8(privateKey),
);

export async function configureGoogle() {
	vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "bifrost@project.iam.gserviceaccount.com");
	vi.stubEnv(
		"GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
		(await privateKey).replaceAll("\n", String.raw`\n`),
	);
	vi.stubEnv("GOOGLE_WORKSPACE_ADMIN_EMAIL", ADMIN_EMAIL);
}

export function configureSlack() {
	vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
	vi.stubEnv("SLACK_INVITE_LINK", "https://join.slack.com/t/navet/shared_invite/test");
}

export function fakeDirectories() {
	const directory = createFakeDirectory();
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
			const url = new URL(input instanceof Request ? input.url : input.toString());
			const body =
				typeof init.body === "string" || init.body instanceof URLSearchParams
					? init.body
					: undefined;
			const answer = FAKED_HOSTS.has(url.hostname)
				? directory.handle({ url, method: init.method ?? "GET", body })
				: null;
			if (!answer) throw new Error(`Unexpected fetch to ${url}`);
			return await Promise.resolve(answer);
		}),
	);
	return directory;
}

export function spyOnWelcomeEmails() {
	return vi.spyOn(iamResend, "sendEmail").mockResolvedValue("email-id" as EmailId);
}
