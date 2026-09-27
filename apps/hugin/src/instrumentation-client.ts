import {
	onRouterTransitionStart as captureRouterTransition,
	initializeClientTelemetry,
} from "@workspace/auth/telemetry-client";
import { isPrivatePath, isPrivateUrl } from "@/lib/private-paths";

export const onRouterTransitionStart: typeof captureRouterTransition = (...args) => {
	if (isPrivatePath(window.location.pathname) || isPrivateUrl(args[0])) return;
	captureRouterTransition(...args);
};

if (!isPrivatePath(window.location.pathname))
	initializeClientTelemetry({
		sentryDsn:
			"https://04d7959e133fb993cec8d4f62d3418ef@o4509833113501696.ingest.de.sentry.io/4509835991253072",
		initializePostHog: false,
		isPrivateUrl,
	});
