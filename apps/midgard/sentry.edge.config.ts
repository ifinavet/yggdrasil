// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { initializeSentry } from "@workspace/auth/telemetry";

initializeSentry(
	"https://97690ed14bdf1b094f610bcfcaef3a6b@o4509833113501696.ingest.de.sentry.io/4509833115336784",
);
