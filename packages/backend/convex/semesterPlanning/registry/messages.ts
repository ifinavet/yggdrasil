import type { BlockedReason } from "./client";

// Norwegian messages the Hugin form shows when the registry lookups refuse or fail.

export const BLOCKED_MESSAGES: Record<BlockedReason, string> = {
	deleted: "Bedriften er slettet fra Enhetsregisteret og kan ikke søke.",
	bankrupt: "Bedriften er konkurs og kan ikke søke.",
	liquidation: "Bedriften er under avvikling og kan ikke søke.",
};

export const REGISTRY_UNAVAILABLE_MESSAGE =
	"Vi får ikke kontakt med Brønnøysundregistrene akkurat nå. Prøv igjen om litt.";

export const RATE_LIMITED_MESSAGE = "Det er mange søk akkurat nå. Prøv igjen om litt.";
