// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { initializeSentry } from "@workspace/auth/telemetry";

initializeSentry(
	"https://97690ed14bdf1b094f610bcfcaef3a6b@o4509833113501696.ingest.de.sentry.io/4509833115336784",
);
