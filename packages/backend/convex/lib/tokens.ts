// Link tokens for emailed URLs. Feedback links store only the SHA-256 hash; offer links store the
// token itself, so an editor can copy the link again. Both functions use Web Crypto, so they run in
// the default Convex runtime.

const TOKEN_BYTES = 32;

/** The length of every link token: 32 bytes in base64url without padding. */
export const LINK_TOKEN_LENGTH = Math.ceil((TOKEN_BYTES * 4) / 3);

/** A random, URL-safe token (256 bits, base64url without padding). */
export function generateLinkToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
	return btoa(String.fromCodePoint(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

/** The lowercase hex SHA-256 of a link token, used as the lookup key. */
export async function hashLinkToken(token: string): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
