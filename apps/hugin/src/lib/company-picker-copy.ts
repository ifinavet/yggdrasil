import type { BlockedReason } from "./company-registry";

// Company-facing copy for the company picker, shared by the Hugin order and application forms.

export const companyPickerCopy = {
	placeholder: "Velg bedrift",
	search: "Søk etter bedrift",
	empty: "Vi fant ingen bedrifter med det navnet.",
	newCompany: "Står ikke bedriften på listen? Søk i Enhetsregisteret",
	registrySearch: "Søk på navn eller organisasjonsnummer",
	registrySearching: "Søker ...",
	registryEmpty: "Ingen treff. Prøv gjerne organisasjonsnummeret.",
	registryTooShort: "Skriv minst to tegn.",
	blocked: {
		deleted: "Slettet fra registeret. Kan ikke velges.",
		bankrupt: "Konkurs. Kan ikke velges.",
		liquidation: "Under avvikling. Kan ikke velges.",
	} satisfies Record<BlockedReason, string>,
	registryRetry: "Prøv igjen",
	backToList: "Velg fra listen i stedet",
} as const;
