// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { initializeSentry } from "@workspace/auth/telemetry";
import { isPrivateUrl } from "./src/lib/private-paths";

initializeSentry(
	"https://04d7959e133fb993cec8d4f62d3418ef@o4509833113501696.ingest.de.sentry.io/4509835991253072",
	// The offer page has its token in the path; keep it out of Sentry.
	{ isPrivateUrl },
);
