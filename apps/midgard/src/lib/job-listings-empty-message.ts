export function jobListingsEmptyMessage(filtered: boolean) {
	return filtered
		? "Ingen stillingsannonser passer med filteret ditt."
		: "Det er ingen stillingsannonser akkurat nå.";
}
