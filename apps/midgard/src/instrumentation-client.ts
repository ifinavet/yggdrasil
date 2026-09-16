import {
	initializeClientTelemetry,
	onRouterTransitionStart,
} from "@workspace/auth/telemetry-client";
import { cookieConsentGiven } from "./components/common/consent";

initializeClientTelemetry({
	sentryDsn:
		"https://97690ed14bdf1b094f610bcfcaef3a6b@o4509833113501696.ingest.de.sentry.io/4509833115336784",
	posthogPersistence: cookieConsentGiven() === "yes" ? "localStorage+cookie" : "memory",
});

export { onRouterTransitionStart };
