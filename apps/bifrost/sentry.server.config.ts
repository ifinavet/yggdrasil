// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { initializeSentry } from "@workspace/auth/telemetry";

initializeSentry(
	"https://04d7959e133fb993cec8d4f62d3418ef@o4509833113501696.ingest.de.sentry.io/4509835991253072",
);
