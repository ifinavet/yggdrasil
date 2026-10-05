"use node";

import { GOOGLE_OAUTH_TOKEN_URL } from "@workspace/shared/constants";
import { normalizeEmail } from "@workspace/shared/iam";
import { JWT } from "google-auth-library";
import { directoryUrl, type GoogleConfig } from "./config";

const USERS_URL = "https://admin.googleapis.com/admin/directory/v1/users";
const SCOPE = "https://www.googleapis.com/auth/admin.directory.user";
const TIMEOUT_MS = 15_000;
const MAX_PAGES = 20;

export type GoogleUser = Readonly<{
	id: string;
	email: string;
	name: string;
	suspended: boolean;
	hasSignedIn: boolean;
}>;

type DirectoryUser = {
	id: string;
	primaryEmail: string;
	suspended?: boolean;
	name?: { fullName?: string };
	lastLoginTime?: string;
};

export class GoogleError extends Error {}

async function fail(
	response: Response,
	message: string,
	secrets: readonly string[] = [],
): Promise<never> {
	const body: unknown = await response.json().catch(() => null);
	let detail = "";
	if (body && typeof body === "object" && "error" in body) {
		const error = body.error;
		if (typeof error === "string") {
			const description = "error_description" in body ? body.error_description : undefined;
			detail = [error, typeof description === "string" ? description : ""]
				.filter(Boolean)
				.join(": ");
		} else if (
			error &&
			typeof error === "object" &&
			"message" in error &&
			typeof error.message === "string"
		) {
			detail = error.message;
		}
	}
	// Only Google's diagnostic fields are used; never include the response or request wholesale.
	for (const secret of secrets) {
		if (secret) detail = detail.replaceAll(secret, "[redacted]");
	}
	detail = detail
		.replaceAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]")
		.replaceAll(/\s+/g, " ")
		.trim()
		.slice(0, 1000);
	throw new GoogleError([message, detail].filter(Boolean).join(" "));
}

export function googleAuth(config: GoogleConfig, subject = config.adminEmail, scopes = SCOPE) {
	const auth = new JWT({
		email: config.serviceAccountEmail,
		key: config.privateKey,
		subject,
		scopes,
	});
	auth.transporter.defaults.fetchImplementation = globalThis.fetch;
	auth.transporter.defaults.timeout = TIMEOUT_MS;
	auth.transporter.interceptors.request.add({
		resolved: (options) =>
			Promise.resolve({
				...options,
				url: new URL(directoryUrl(String(options.url ?? GOOGLE_OAUTH_TOKEN_URL))),
			}),
	});
	return auth;
}

async function googleAccessToken(config: GoogleConfig) {
	try {
		const auth = googleAuth(config);
		auth.transporter.interceptors.request.add({
			resolved: (options) =>
				Promise.resolve({ ...options, retry: false, retryConfig: { retry: 0 } }),
		});
		const credentials = await auth.authorize();
		if (typeof credentials.access_token !== "string" || !credentials.access_token.trim())
			throw new GoogleError("Google-tilkoblingen feilet. Google returnerte ikke et tilgangstoken.");
		return credentials.access_token;
	} catch (error) {
		if (error && typeof error === "object" && "response" in error) {
			const response = error.response as { status?: number; data?: unknown } | undefined;
			if (response?.status)
				return fail(
					Response.json(response.data ?? null, { status: response.status }),
					`Google avviste innloggingen (${response.status}).`,
					[config.privateKey, config.privateKey.replaceAll("\n", String.raw`\n`)],
				);
		}
		throw error;
	}
}

function toUser(user: DirectoryUser): GoogleUser {
	return {
		id: user.id,
		email: normalizeEmail(user.primaryEmail),
		name: user.name?.fullName ?? "",
		suspended: user.suspended === true,
		hasSignedIn: user.lastLoginTime !== undefined && Date.parse(user.lastLoginTime) > 0,
	};
}

export function googleClient(
	config: GoogleConfig,
	onConnection?: (message: string | undefined, startedAt: number) => Promise<unknown>,
) {
	let token: Promise<string> | undefined;

	async function call(path: string, init: RequestInit = {}) {
		token ??= (async () => {
			const startedAt = Date.now();
			let value: string;
			try {
				value = await googleAccessToken(config);
			} catch (error) {
				const message =
					error instanceof GoogleError
						? error.message
						: "Google-tilkoblingen feilet. Kontroller tjenestekontonøkkelen og nettverkstilgangen.";
				await onConnection?.(message, startedAt);
				throw new GoogleError(message);
			}
			await onConnection?.(undefined, startedAt);
			return value;
		})();
		return fetch(directoryUrl(`${USERS_URL}${path}`), {
			...init,
			headers: {
				Authorization: `Bearer ${await token}`,
				"Content-Type": "application/json",
			},
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	}

	return {
		async createUser(user: {
			email: string;
			firstName: string;
			lastName: string;
			password: string;
			recoveryEmail?: string;
		}): Promise<GoogleUser | "exists"> {
			const response = await call("", {
				method: "POST",
				body: JSON.stringify({
					primaryEmail: user.email,
					name: { givenName: user.firstName, familyName: user.lastName },
					password: user.password,
					changePasswordAtNextLogin: true,
					recoveryEmail: user.recoveryEmail,
				}),
			});
			if (response.status === 409) return "exists";
			if (!response.ok)
				return fail(response, `Google svarte ${response.status} da vi skulle opprette kontoen.`, [
					(await token) ?? "",
					user.password,
				]);
			return toUser((await response.json()) as DirectoryUser);
		},

		async getUser(key: string): Promise<GoogleUser | null> {
			const response = await call(`/${encodeURIComponent(key)}`);
			if (response.status === 404) return null;
			if (!response.ok)
				return fail(response, `Google svarte ${response.status} da vi skulle hente kontoen.`, [
					(await token) ?? "",
				]);
			return toUser((await response.json()) as DirectoryUser);
		},

		async updateUser(
			key: string,
			fields: Readonly<{ suspended?: boolean; password?: string; recoveryEmail?: string }>,
		): Promise<GoogleUser | null> {
			const response = await call(`/${encodeURIComponent(key)}`, {
				method: "PATCH",
				body: JSON.stringify(
					fields.password ? { ...fields, changePasswordAtNextLogin: true } : fields,
				),
			});
			if (response.status === 404) return null;
			if (!response.ok)
				return fail(response, `Google svarte ${response.status} da vi skulle oppdatere kontoen.`, [
					(await token) ?? "",
					fields.password ?? "",
				]);
			return toUser((await response.json()) as DirectoryUser);
		},

		async listUsers(): Promise<GoogleUser[]> {
			const users: GoogleUser[] = [];
			let pageToken: string | undefined;
			for (let page = 0; page < MAX_PAGES; page++) {
				const params = new URLSearchParams({ domain: config.domain, maxResults: "500" });
				if (pageToken) params.set("pageToken", pageToken);
				const response = await call(`?${params}`);
				if (!response.ok)
					return fail(response, `Google svarte ${response.status} da vi skulle liste kontoene.`, [
						(await token) ?? "",
					]);
				const body = (await response.json()) as { users?: DirectoryUser[]; nextPageToken?: string };
				users.push(...(body.users ?? []).map(toUser));
				pageToken = body.nextPageToken;
				if (!pageToken) return users;
			}
			throw new GoogleError("Google returnerte flere kontoer enn vi kan lese på én gang.");
		},
	};
}
