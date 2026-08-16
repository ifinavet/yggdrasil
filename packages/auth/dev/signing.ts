import "server-only";

import {
	DEV_AUTH_AUDIENCE,
	DEV_AUTH_ISSUER,
	DEV_AUTH_KEY_ID,
	DEV_AUTH_TOKEN_TTL_SECONDS,
	DEV_USERS,
	type DevUser,
} from "@workspace/shared/constants";
import { importJWK, type JWK, SignJWT } from "jose";

export function devAuthConfigured(): boolean {
	return Boolean(process.env.DEV_AUTH_PRIVATE_JWK);
}

export function findDevUser(externalId: string | undefined): DevUser | undefined {
	if (!externalId) return undefined;
	return DEV_USERS.find((user) => user.externalId === externalId);
}

function readSigningKey(): JWK {
	const raw = process.env.DEV_AUTH_PRIVATE_JWK;
	if (!raw) {
		throw new Error(
			"DEV_AUTH_PRIVATE_JWK is not set. Run `pnpm setup:local` to generate a development signing key.",
		);
	}

	try {
		return JSON.parse(raw) as JWK;
	} catch {
		throw new Error("DEV_AUTH_PRIVATE_JWK is not valid JSON. Re-run `pnpm setup:local`.");
	}
}

export async function mintDevToken(user: DevUser): Promise<string> {
	const key = await importJWK(readSigningKey(), "RS256");

	return await new SignJWT({
		email: user.email,
		given_name: user.firstName,
		family_name: user.lastName,
		name: `${user.firstName} ${user.lastName}`,
	})
		.setProtectedHeader({ alg: "RS256", kid: DEV_AUTH_KEY_ID })
		.setSubject(user.externalId)
		.setIssuer(DEV_AUTH_ISSUER)
		.setAudience(DEV_AUTH_AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(`${DEV_AUTH_TOKEN_TTL_SECONDS}s`)
		.sign(key);
}
