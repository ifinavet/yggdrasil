import * as Sentry from "@sentry/nextjs";
import { isLocalDevelopment } from "./local";

export function withTelemetry<T extends object>(options: T): T & { enabled?: boolean } {
	return isLocalDevelopment ? { ...options, enabled: false } : options;
}

export function runTelemetry(initialize: () => void): void {
	if (!isLocalDevelopment) initialize();
}

/** Tells whether a URL, path or route name belongs to a page Sentry must not see. */
export type IsPrivateUrl = (value: string | undefined) => boolean;

/**
 * Sentry hooks that drop every error, transaction and breadcrumb from a private page, such as a
 * page whose address carries an access token.
 */
export function withoutPrivatePages(isPrivateUrl: IsPrivateUrl) {
	const dropPrivate = <E extends Sentry.Event>(event: E): E | null =>
		isPrivateUrl(event.request?.url) || isPrivateUrl(event.transaction) ? null : event;
	return {
		beforeSend: dropPrivate,
		beforeSendTransaction: dropPrivate,
		beforeBreadcrumb: (breadcrumb: Sentry.Breadcrumb) =>
			[breadcrumb.data?.url, breadcrumb.data?.from, breadcrumb.data?.to].some((value) =>
				isPrivateUrl(typeof value === "string" ? value : undefined),
			)
				? null
				: breadcrumb,
	};
}

export function initializeSentry(
	dsn: string,
	{ isPrivateUrl }: { isPrivateUrl?: IsPrivateUrl } = {},
): void {
	Sentry.init(
		withTelemetry({
			dsn,

			// Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
			tracesSampleRate: 1,
			// Enable logs to be sent to Sentry
			enableLogs: true,

			// Setting this option to true will print useful information to the console while you're setting up Sentry.
			debug: false,

			...(isPrivateUrl ? withoutPrivatePages(isPrivateUrl) : {}),
		}),
	);
}
