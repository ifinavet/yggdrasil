"use client";

import { useCookieConsent } from "@workspace/auth/telemetry-client";
import { ConsentBanner } from "@workspace/ui/components/consent-banner";

export function Consent() {
	const { consent, accept, decline } = useCookieConsent();

	return consent === "undecided" && <ConsentBanner onAccept={accept} onDecline={decline} />;
}
