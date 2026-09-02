import * as Sentry from "@sentry/nextjs";

const sentryDsn =
	process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
	(process.env.NODE_ENV === "production"
		? "https://04d7959e133fb993cec8d4f62d3418ef@o4509833113501696.ingest.de.sentry.io/4509835991253072"
		: undefined);

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
