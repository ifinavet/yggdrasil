import { initializeClientTelemetry, posthogPersistence } from "@workspace/auth/telemetry-client";

export { onRouterTransitionStart } from "@workspace/auth/telemetry-client";

initializeClientTelemetry({
	sentryDsn:
		"https://97690ed14bdf1b094f610bcfcaef3a6b@o4509833113501696.ingest.de.sentry.io/4509833115336784",
	posthogPersistence: posthogPersistence(),
});
