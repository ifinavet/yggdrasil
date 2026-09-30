import { normalizeEmail } from "@workspace/shared/iam";
import { importPKCS8, SignJWT } from "jose";
import { directoryUrl, type GoogleConfig } from "./config";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
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

async function accessToken(config: GoogleConfig) {
	const assertion = await new SignJWT({ scope: SCOPE })
		.setProtectedHeader({ alg: "RS256", typ: "JWT" })
		.setIssuer(config.serviceAccountEmail)
		.setSubject(config.adminEmail)
		.setAudience(TOKEN_URL)
		.setIssuedAt()
		.setExpirationTime("10m")
		.sign(await importPKCS8(config.privateKey, "RS256"));
	const response = await fetch(directoryUrl(TOKEN_URL), {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion,
		}),
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) throw new GoogleError(`Google avviste innloggingen (${response.status}).`);
	const { access_token } = (await response.json()) as { access_token: string };
	return access_token;
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

function fail(response: Response, action: string): never {
	throw new GoogleError(`Google svarte ${response.status} da vi skulle ${action}.`);
}

export function googleClient(config: GoogleConfig) {
	let token: Promise<string> | undefined;

	async function call(path: string, init: RequestInit = {}) {
		token ??= accessToken(config);
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
			if (!response.ok) return fail(response, "opprette kontoen");
			return toUser((await response.json()) as DirectoryUser);
		},

		async getUser(key: string): Promise<GoogleUser | null> {
			const response = await call(`/${encodeURIComponent(key)}`);
			if (response.status === 404) return null;
			if (!response.ok) return fail(response, "hente kontoen");
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
			if (!response.ok) return fail(response, "oppdatere kontoen");
			return toUser((await response.json()) as DirectoryUser);
		},

		async listUsers(): Promise<GoogleUser[]> {
			const users: GoogleUser[] = [];
			let pageToken: string | undefined;
			for (let page = 0; page < MAX_PAGES; page++) {
				const params = new URLSearchParams({ domain: config.domain, maxResults: "500" });
				if (pageToken) params.set("pageToken", pageToken);
				const response = await call(`?${params}`);
				if (!response.ok) return fail(response, "liste kontoene");
				const body = (await response.json()) as { users?: DirectoryUser[]; nextPageToken?: string };
				users.push(...(body.users ?? []).map(toUser));
				pageToken = body.nextPageToken;
				if (!pageToken) return users;
			}
			throw new GoogleError("Google returnerte flere kontoer enn vi kan lese på én gang.");
		},
	};
}
