import type { FeedbackField } from "@workspace/shared/feedback";

/** Version-one snapshot of the questions shipped in #284. Stable keys preserve old answers. */
export const defaultFeedbackFields: FeedbackField[] = [
	{
		key: "satisfaction",
		type: "rating",
		label: "Hvordan syntes du arrangementet var?",
		low: "Veldig dårlig",
		high: "Veldig bra",
		required: true,
	},
	{
		key: "impression",
		type: "rating",
		label: "Hvilket inntrykk fikk du av bedriften?",
		low: "Veldig dårlig",
		high: "Veldig bra",
		required: true,
	},
	{
		key: "expectation",
		type: "rating",
		label: "Var arrangementet som forventet?",
		low: "Dårligere enn forventet",
		high: "Bedre enn forventet",
		required: true,
	},
	{
		key: "toughts",
		type: "text",
		label: "Hva syntes du om arrangementet og bedriften?",
		placeholder: "F.eks. «Godt lagt opp, men litt knapp tid til spørsmål»",
		required: true,
	},
	{
		key: "improvements",
		type: "text",
		label: "Hva kunne gjort arrangementet bedre?",
		placeholder: "F.eks. «Mer tid til mingling etterpå»",
		required: true,
	},
	{
		key: "want_to_work",
		type: "yesNo",
		label: "Kunne du tenkt deg å jobbe for denne bedriften?",
		required: true,
	},
	{
		key: "word_of_mouth",
		type: "options",
		label: "Hvordan fikk du vite om arrangementet?",
		options: [
			"Ifinavet.no",
			"Stand utenfor Simula",
			"Facebook (IFI-studenter)",
			"Facebook (Arrangementside)",
			"Instagram",
			"Venner",
		],
		allowOther: true,
		required: true,
	},
	{ key: "other", type: "text", label: "Noe annet du vil si?", placeholder: "", required: false },
];
