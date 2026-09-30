/** Array order controls the checklist; IDs keep completion stable when steps move. */
export const EVENT_CHECKLIST = [
	{
		id: "planning",
		label: "Planlegging",
		steps: [
			{ id: "company-contact", label: "Kontakt bedriften" },
			{ id: "room", label: "Bekreft rom eller restaurant" },
			{ id: "format", label: "Avklar format, kapasitet og servering" },
		],
	},
	{
		id: "registration",
		label: "Påmelding",
		steps: [
			{ id: "description", label: "Avklar arrangementsteksten" },
			{
				id: "promotion",
				label: "Avklar promotering med PR-ansvarlig og sjekk Innsikt for prognosen",
			},
			{ id: "helpers", label: "Bekreft medhjelperne" },
		],
	},
	{
		id: "preparation",
		label: "Forberedelser",
		steps: [
			{ id: "food", label: "Bekreft matbestilling" },
			{ id: "practical", label: "Avklar praktisk informasjon med bedriften" },
		],
	},
	{
		id: "event",
		label: "Arrangementsdag",
		steps: [
			{ id: "welcome", label: "Ta imot bedriften og klargjør utstyr" },
			{ id: "feedback-reminder", label: "Minn deltakerne om tilbakemeldinger" },
		],
	},
	{
		id: "followup",
		label: "Etterarbeid",
		steps: [
			{ id: "expenses", label: "Send inn eventuelle utlegg" },
			{ id: "company-followup", label: "Følg opp bedriften" },
		],
	},
] as const;

export type ChecklistPhase = (typeof EVENT_CHECKLIST)[number]["id"];
export type ChecklistStep = (typeof EVENT_CHECKLIST)[number]["steps"][number]["id"];

export function helperConfirmation(names: readonly string[]): string {
	if (names.length === 0) return "Velg medhjelpere";
	return `Bekreft at ${new Intl.ListFormat("nb", { type: "conjunction" }).format(names)} ${names.length === 1 ? "skal være medhjelper" : "skal være medhjelpere"}`;
}
