import type { EmailId } from "@convex-dev/resend";
import { exportPKCS8, generateKeyPair } from "jose";
import { vi } from "vitest";
import { iamResend } from "../convex/iam/actions";

export const DOMAIN = "ifinavet.no";
export const ADMIN_EMAIL = `admin@${DOMAIN}`;

type FakeGoogleUser = { name: string; suspended: boolean; password?: string; signedIn?: boolean };
type FakeSlackUser = { id: string; email: string; name: string; deleted?: boolean; bot?: boolean };
type Call = { method: string; url: string; body: unknown };

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

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function directoryUser(email: string, user: FakeGoogleUser) {
	return {
		primaryEmail: email,
		name: { fullName: user.name },
		suspended: user.suspended,
		lastLoginTime: user.signedIn ? "2026-01-15T10:00:00.000Z" : "1970-01-01T00:00:00.000Z",
	};
}

export function fakeDirectories() {
	const google = new Map<string, FakeGoogleUser>();
	const slackUsers: FakeSlackUser[] = [];
	const slackChannels = new Map<string, string[]>();
	const calls: Call[] = [];
	const generalChannels = new Set<string>();
	const restrictedChannels = new Set<string>();
	const failures = { google: false };

	function handleGoogle(method: string, url: URL, body: Record<string, unknown>) {
		if (failures.google) return json({ error: "down" }, 503);
		const email = decodeURIComponent(url.pathname.split("/users/")[1] ?? "");
		if (method === "POST" && !email) {
			const primaryEmail = String(body.primaryEmail);
			if (google.has(primaryEmail)) return json({ error: "exists" }, 409);
			const name = body.name as { givenName: string; familyName: string };
			google.set(primaryEmail, {
				name: `${name.givenName} ${name.familyName}`,
				suspended: false,
				password: String(body.password),
			});
			return json(directoryUser(primaryEmail, google.get(primaryEmail) as FakeGoogleUser), 201);
		}
		if (!email) {
			return json({ users: [...google].map(([address, user]) => directoryUser(address, user)) });
		}
		const user = google.get(email);
		if (!user) return json({ error: "not found" }, 404);
		if (method === "PATCH") {
			if (typeof body.suspended === "boolean") user.suspended = body.suspended;
			if (typeof body.password === "string") user.password = body.password;
		}
		return json(directoryUser(email, user));
	}

	function handleSlack(method: string, params: URLSearchParams) {
		if (method === "users.lookupByEmail") {
			const user = slackUsers.find((candidate) => candidate.email === params.get("email"));
			return json(
				user ? { ok: true, user: { id: user.id } } : { ok: false, error: "users_not_found" },
			);
		}
		if (method === "users.conversations") {
			const channels = slackChannels.get(params.get("user") ?? "") ?? [];
			return json({ ok: true, channels: channels.map((id) => ({ id })) });
		}
		if (method === "conversations.kick") {
			const userId = params.get("user") ?? "";
			const channels = slackChannels.get(userId) ?? [];
			if (generalChannels.has(params.get("channel") ?? "")) {
				return json({ ok: false, error: "cant_kick_from_general" });
			}
			if (restrictedChannels.has(params.get("channel") ?? "")) {
				return json({ ok: false, error: "restricted_action" });
			}
			if (!channels.includes(params.get("channel") ?? ""))
				return json({ ok: false, error: "not_in_channel" });
			slackChannels.set(
				userId,
				channels.filter((channel) => channel !== params.get("channel")),
			);
			return json({ ok: true });
		}
		if (method === "users.list") {
			return json({
				ok: true,
				members: slackUsers.map((user) => ({
					id: user.id,
					deleted: user.deleted ?? false,
					is_bot: user.bot ?? false,
					profile: { email: user.email, real_name: user.name },
				})),
			});
		}
		return json({ ok: false, error: "unknown_method" });
	}

	const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
		const url = new URL(input instanceof Request ? input.url : input.toString());
		const method = init.method ?? "GET";
		if (url.hostname === "oauth2.googleapis.com") {
			calls.push({ method, url: url.toString(), body: null });
			return json({ access_token: "google-token", expires_in: 3600 });
		}
		if (url.hostname === "admin.googleapis.com") {
			const body =
				typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
			calls.push({ method, url: url.toString(), body });
			return handleGoogle(method, url, body);
		}
		if (url.hostname === "slack.com") {
			const params = new URLSearchParams(
				init.body instanceof URLSearchParams ? init.body : undefined,
			);
			const slackMethod = url.pathname.replace("/api/", "");
			calls.push({ method: slackMethod, url: url.toString(), body: Object.fromEntries(params) });
			return handleSlack(slackMethod, params);
		}
		throw new Error(`Unexpected fetch to ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);

	return {
		google,
		slackUsers,
		slackChannels,
		generalChannels,
		restrictedChannels,
		calls,
		failures,
	};
}

export function spyOnWelcomeEmails() {
	return vi.spyOn(iamResend, "sendEmail").mockResolvedValue("email-id" as EmailId);
}
