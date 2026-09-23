import {
	onRouterTransitionStart as captureRouterTransition,
	initializeClientTelemetry,
} from "@workspace/auth/telemetry-client";

export const onRouterTransitionStart: typeof captureRouterTransition = (...args) => {
	if (
		["/feedback", "/report"].includes(window.location.pathname) ||
		["/feedback", "/report"].includes(args[0].split(/[?#]/)[0] ?? "")
	)
		return;
	captureRouterTransition(...args);
};

if (!["/feedback", "/report"].includes(window.location.pathname))
	initializeClientTelemetry({
		sentryDsn:
			"https://04d7959e133fb993cec8d4f62d3418ef@o4509833113501696.ingest.de.sentry.io/4509835991253072",
		initializePostHog: false,
	});
