import {
	initializeClientTelemetry,
	onRouterTransitionStart,
} from "@workspace/auth/telemetry-client";

initializeClientTelemetry({
	sentryDsn:
		"https://04d7959e133fb993cec8d4f62d3418ef@o4509833113501696.ingest.de.sentry.io/4509835991253072",
	initializePostHog: false,
});

export { onRouterTransitionStart };
