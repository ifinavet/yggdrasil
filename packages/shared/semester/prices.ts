import type { EventType } from "./labels";

/**
 * What Navet charges per event type, in NOK excluding VAT. A social event has no set price, so it
 * has no entry. Shown on the Hugin application form and on the companies page in Midgard.
 */
export const EVENT_TYPE_PRICES: Partial<Record<EventType, number>> = {
	large_presentation: 40_000,
	standard_presentation: 30_000,
	workshop: 20_000,
};

const nokFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

/** «30 000», an amount of kroner the way Norwegian writes it. */
export function formatNok(amount: number): string {
	return nokFormat.format(amount);
}
