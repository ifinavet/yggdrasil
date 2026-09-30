const INTERNAL_ORIGIN = "https://internal.invalid";

export function safeRedirectPath(value: string | null | undefined): string {
	if (!value?.startsWith("/")) return "/";
	const url = new URL(value, INTERNAL_ORIGIN);
	if (url.origin !== INTERNAL_ORIGIN) return "/";
	return `${url.pathname}${url.search}${url.hash}`;
}

export function redirectFromSearch(search: string): string {
	return safeRedirectPath(new URLSearchParams(search).get("redirect"));
}

export function withRedirect(path: "/sign-in" | "/sign-up", redirect: string): string {
	return `${path}?${new URLSearchParams({ redirect: safeRedirectPath(redirect) })}`;
}
