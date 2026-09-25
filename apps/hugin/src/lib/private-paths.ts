// Pages whose address carries an access token: the invitation fragment on /feedback and /report,
// and the offer token in the path of /bestill-bedpres/tilbud/<token>. Analytics and error
// reporting stay off there, so the token never reaches PostHog or Sentry.
//
// The offer token is in the path, not a fragment, because the page preloads the offer on the
// server. So it still reaches the host's request logs; only the offer email and those logs hold it.

const PRIVATE_PAGES = ["/feedback", "/report"];
const PRIVATE_PREFIXES = ["/bestill-bedpres/tilbud/"];

/** Whether a pathname («/bestill-bedpres/tilbud/abc») is one of the token pages. */
export function isPrivatePath(pathname: string): boolean {
	return (
		PRIVATE_PAGES.includes(pathname) ||
		PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
	);
}

/**
 * Whether a URL, path or route name («GET /bestill-bedpres/tilbud/[token]») points at a token page.
 * Query strings and fragments are ignored.
 */
export function isPrivateUrl(value: string | undefined): boolean {
	if (!value) return false;
	if (value.includes("://")) {
		try {
			return isPrivatePath(new URL(value).pathname);
		} catch {
			return false;
		}
	}
	const start = value.indexOf("/");
	return start !== -1 && isPrivatePath(value.slice(start).split(/[?#]/)[0] ?? "");
}
