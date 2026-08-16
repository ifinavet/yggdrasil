import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { cookieConsentGiven } from "./components/common/consent";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const sentryDsn =
	process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
	(process.env.NODE_ENV === "production"
		? "https://97690ed14bdf1b094f610bcfcaef3a6b@o4509833113501696.ingest.de.sentry.io/4509833115336784"
		: undefined);

if (posthogKey && posthogHost) {
	posthog.init(posthogKey, {
		api_host: "/relay-aXgZ",
		ui_host: "https://eu.posthog.com",
		defaults: "2025-05-24",
		persistence: cookieConsentGiven() === "yes" ? "localStorage+cookie" : "memory",
	});
}

if (sentryDsn) {
	Sentry.init({
		dsn: sentryDsn,

		// Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
		tracesSampleRate: 1,
		// Enable logs to be sent to Sentry
		enableLogs: true,

		// Setting this option to true will print useful information to the console while you're setting up Sentry.
		debug: false,
	});
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
