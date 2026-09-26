const ORDER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readOrderToken(fragment: string): string | null {
	const token = new URLSearchParams(fragment.replace(/^#/, "")).get("token");
	return token && ORDER_TOKEN_PATTERN.test(token) ? token : null;
}
