"use client";

import { useCookieConsent } from "@workspace/auth/telemetry-client";
import { ConsentBanner } from "@workspace/ui/components/consent-banner";

/** Asks for cookie consent; PostHog stays in memory until the visitor says yes. */
export function Consent() {
	const { consent, accept, decline } = useCookieConsent();

	return consent === "undecided" && <ConsentBanner onAccept={accept} onDecline={decline} />;
}
