import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { cookieConsentGiven } from "./components/common/consent";

if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) {
  throw new Error("PostHog environment variables are not set");
}

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: "/relay-aXgZ",
  ui_host: "https://eu.posthog.com",
  defaults: "2025-05-24",
  persistence: cookieConsentGiven() === "yes" ? "localStorage+cookie" : "memory",
});

Sentry.init({
  dsn: "https://97690ed14bdf1b094f610bcfcaef3a6b@o4509833113501696.ingest.de.sentry.io/4509833115336784",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
