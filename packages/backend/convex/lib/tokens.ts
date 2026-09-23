// Link tokens: the plaintext goes only into an emailed URL, and the database stores the SHA-256 hash.
// Both functions use Web Crypto, so they run in the default Convex runtime.

const TOKEN_BYTES = 32;

/** A random, URL-safe token (256 bits, base64url without padding). */
export function generateToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
	return btoa(String.fromCodePoint(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

/** The lowercase hex SHA-256 of a token, used as the lookup key. */
export async function hashToken(token: string): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
