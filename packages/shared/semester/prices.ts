const nokFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

/** «30 000», an amount of kroner the way Norwegian writes it. */
export function formatNok(amount: number): string {
	return nokFormat.format(amount);
}
