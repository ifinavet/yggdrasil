import * as Sentry from "@sentry/nextjs";
import { isLocalDevelopment } from "./local";

export function withTelemetry<T extends object>(options: T): T & { enabled?: boolean } {
	return isLocalDevelopment ? { ...options, enabled: false } : options;
}

export function runTelemetry(initialize: () => void): void {
	if (!isLocalDevelopment) initialize();
}

export function initializeSentry(dsn: string): void {
	Sentry.init(
		withTelemetry({
			dsn,

			// Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
			tracesSampleRate: 1,
			// Enable logs to be sent to Sentry
			enableLogs: true,

			// Setting this option to true will print useful information to the console while you're setting up Sentry.
			debug: false,
		}),
	);
}
