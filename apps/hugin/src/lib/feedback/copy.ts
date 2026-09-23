export const feedbackStateCopy = {
	invalid: {
		title: "Lenken er ugyldig",
		body: "Åpne lenken fra e-posten du fikk etter arrangementet.",
	},
	unavailable: {
		title: "Tilbakemeldinger er slått av",
		body: "Dette arrangementet tar ikke imot tilbakemeldinger nå.",
	},
	"not-open": {
		title: "Skjemaet er ikke åpnet ennå",
		body: "Prøv igjen når innsamlingen har åpnet.",
	},
	closed: {
		title: "Innsamlingen er avsluttet",
		body: "Fristen for å sende inn tilbakemelding har gått ut.",
	},
	"already-submitted": {
		title: "Du har allerede svart",
		body: "Takk for tilbakemeldingen! Du kan svare én gang per arrangement.",
	},
	submitted: {
		title: "Takk for tilbakemeldingen!",
		body: "Svaret ditt er lagret. Du kan lukke denne siden.",
	},
	error: { title: "Kunne ikke hente skjemaet", body: "Sjekk nettforbindelsen og prøv igjen." },
} as const;
export const feedbackCopy = {
	loading: "Henter skjema …",
	retry: "Prøv igjen",
	submit: "Send inn svar",
	submitting: "Sender …",
	submitError: "Kunne ikke sende svaret. Svarene dine er beholdt. Prøv igjen.",
	validationError: "Se gjennom de markerte spørsmålene før du sender inn.",
	introduction: "Takk for at du kom! Fortell oss hvordan du opplevde arrangementet.",
	optional: "valgfritt",
};
