const EMAIL_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The token in a confirmation link's fragment, `#token=…`, or null when there is none. */
export function readEmailLinkToken(fragment: string): string | null {
	const token = new URLSearchParams(fragment.replace(/^#/, "")).get("token");
	return token && EMAIL_LINK_TOKEN_PATTERN.test(token) ? token : null;
}
