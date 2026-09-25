import { JOB_LISTING_ORDER_EMAIL, LOGO_MAX_BYTES } from "@workspace/shared/job-listing-orders";

export const orderPageCopy = {
	title: "Bestill stillingsannonse",
	notFound: {
		title: "Fant ikke siden",
		body: "Siden du leter etter finnes ikke.",
	},
	closed: {
		title: "Bestillingsskjemaet er stengt",
		body: `Ta kontakt på ${JOB_LISTING_ORDER_EMAIL} hvis dere vil bestille stillingsannonser.`,
	},
	unavailable: {
		title: "Bestilling er ikke tilgjengelig",
		body: `Ta kontakt på ${JOB_LISTING_ORDER_EMAIL} hvis dere vil bestille stillingsannonser.`,
	},
} as const;

export const companyCopy = {
	legend: "Bedrift",
	placeholder: "Velg bedrift",
	search: "Søk etter bedrift",
	empty: "Fant ingen bedrifter.",
	newCompany: "Finner dere ikke bedriften? Søk i Enhetsregisteret",
	registrySearch: "Søk på navn eller organisasjonsnummer",
	registrySearching: "Søker ...",
	registryEmpty: "Ingen treff i Enhetsregisteret.",
	registryTooShort: "Skriv minst to tegn.",
	registryBlocked: "Kan ikke velges",
	backToList: "Velg fra listen i stedet",
	orgNumber: "Organisasjonsnummer",
	registryName: "Navn i Enhetsregisteret",
	displayName: "Visningsnavn",
	description: "Om bedriften",
	logo: "Logo",
	uploadLogo: "Last opp logo",
	replaceLogo: "Bytt logo",
	editLogo: "Endre logo",
	logoHint: `PNG eller SVG, høyst ${LOGO_MAX_BYTES / 1_000_000} MB.`,
	logoUploading: "Laster opp ...",
	logoWrongType: "Logoen må være PNG eller SVG.",
	logoTooLarge: `Logoen kan være høyst ${LOGO_MAX_BYTES / 1_000_000} MB.`,
	logoFailed: "Opplastingen feilet. Prøv igjen.",
	correctQuestion: "Stemmer informasjonen om bedriften?",
	yes: "Ja",
	no: "Nei",
	answerRequired: "Svar ja eller nei.",
	changesHint: "Endringene sendes til Navet for godkjenning.",
	billingOnFile: "Fakturainformasjon er registrert.",
	billingMissing: "Fakturainformasjon mangler.",
} as const;

export const packageCopy = {
	legend: "Pakke",
	quantity: "Antall annonser",
	quantityInfo: "Antall annonser på nettsiden, ikke antall stillinger dere ansetter til.",
	startup: "Oppstartsbedrift",
	price: "Pris",
} as const;

export const listingCopy = {
	legend: (position: number) => `Annonse ${position}`,
	title: "Tittel",
	teaser: "Intro",
	description: "Beskrivelse",
	applicationUrl: "Søknadslenke",
	applicationUrlPlaceholder: "https://",
	deadline: "Søknadsfrist",
	type: "Ansettelsesform",
	typePlaceholder: "Velg ansettelsesform",
	counter: (length: number, max: number) => `${length}/${max}`,
} as const;

export const contactCopy = {
	legend: "Kontaktperson",
	name: "Navn",
	email: "E-post",
	phone: "Telefon (valgfritt)",
} as const;

export const billingCopy = {
	legend: "Faktura",
	address: "Fakturaadresse",
	email: "Fakturaepost",
	reference: "Referanse",
	change: "Oppdater fakturainformasjonen",
} as const;

export const submitCopy = {
	note: "Tilleggsinformasjon (valgfritt)",
	confirmAmount: (price: string) => `Jeg bekrefter bestillingen på ${price}.`,
	honeypot: "Nettside",
	submit: "Send bestilling",
	submitting: "Sender ...",
	failed: "Noe gikk galt. Prøv igjen.",
	invalid: "Noen felt mangler eller er feil.",
} as const;

export const checkEmailCopy = {
	title: "Sjekk e-posten",
	body: (email: string) =>
		`Vi har sendt en lenke til ${email}. Bestillingen sendes først når du har bekreftet den.`,
	resend: "Send e-posten på nytt",
	resending: "Sender ...",
	resent: "Ny e-post er sendt.",
	failed: "Kunne ikke sende e-posten. Prøv igjen.",
} as const;

export const confirmCopy = {
	title: "Bekreft bestillingen",
	body: "Trykk på knappen for å sende bestillingen til Navet.",
	button: "Bekreft bestilling",
	confirming: "Bekrefter ...",
	backToForm: "Til bestillingsskjemaet",
	retry: "Prøv igjen",
	expired: {
		title: "Lenken har utløpt",
		body: "Send bestillingen på nytt fra skjemaet.",
	},
	invalid: {
		title: "Lenken er ugyldig",
		body: "Åpne lenken fra e-posten, eller send en ny bestilling.",
	},
	error: {
		title: "Noe gikk galt",
		body: "Vi kunne ikke bekrefte bestillingen. Prøv igjen om litt.",
	},
} as const;

export const receiptCopy = {
	title: "Bestillingen er bekreftet",
	body: "Vi har sendt en kvittering på e-post. Annonsene publiseres når vi har gått gjennom bestillingen.",
	reference: "Referanse",
	company: "Bedrift",
	product: "Produkt",
	quantity: "Antall annonser",
	price: "Pris",
	contact: "Kontakt",
	listings: "Annonser",
	updateRequested: "Endringene i bedriftsinformasjonen godkjennes av Navet før de publiseres.",
	print: "Skriv ut",
	feedback: "Hvordan var det å bestille?",
	feedbackSubmit: "Send tilbakemelding",
	feedbackSending: "Sender ...",
	feedbackThanks: "Takk for tilbakemeldingen!",
	feedbackFailed: "Kunne ikke lagre tilbakemeldingen. Prøv igjen.",
} as const;
