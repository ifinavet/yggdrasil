import {
	onRouterTransitionStart as captureRouterTransition,
	initializeClientTelemetry,
} from "@workspace/auth/telemetry-client";

export const onRouterTransitionStart: typeof captureRouterTransition = (...args) => {
	if (window.location.pathname === "/feedback" || args[0].split(/[?#]/)[0] === "/feedback") return;
	captureRouterTransition(...args);
};

if (window.location.pathname !== "/feedback")
	initializeClientTelemetry({
		sentryDsn:
			"https://04d7959e133fb993cec8d4f62d3418ef@o4509833113501696.ingest.de.sentry.io/4509835991253072",
		initializePostHog: false,
	});
