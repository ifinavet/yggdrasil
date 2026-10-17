import { JOB_LISTING_ORDER_EMAIL } from "@workspace/shared/constants";
import { LISTING_FIELD_LABELS } from "@workspace/shared/job-listing-orders";

export const orderPageCopy = {
	title: "Bestill stillingsannonse",
	intro: `Så fint at dere vil nå informatikkstudentene! Vi ser over annonsene før de publiseres. Lurer dere på noe? Skriv til oss på ${JOB_LISTING_ORDER_EMAIL}.`,
	guide: "Velg bedrift, skriv annonsen og legg inn kontakt- og fakturainformasjon.",
	closed: {
		title: "Bestillingsskjemaet er stengt akkurat nå",
		body: `Vil dere bestille stillingsannonser likevel? Skriv til oss på ${JOB_LISTING_ORDER_EMAIL}, så hjelper vi dere.`,
	},
	unavailable: {
		title: "Vi får ikke tatt imot bestillinger akkurat nå",
		body: `Skriv til oss på ${JOB_LISTING_ORDER_EMAIL}, så ordner vi bestillingen sammen med dere.`,
	},
} as const;

export const companyCopy = {
	legend: "Bedrift",
	orgNumber: "Organisasjonsnummer",
	registryName: "Navn i Enhetsregisteret",
	displayName: "Visningsnavn",
	description: "Om bedriften",
	logo: "Logo",
	uploadLogo: "Last opp logo",
	replaceLogo: "Bytt logo",
	editLogo: "Endre logo",
	logoUploading: "Laster opp ...",
	correctQuestion: "Stemmer informasjonen om bedriften?",
	yes: "Ja",
	no: "Nei",
	answerRequired: "Svar ja eller nei.",
	changesLegend: "Endringsforslag",
	changesHint: "Vi ser over endringene før de vises på nettsiden.",
	saveChanges: "Lagre endringsforslag",
	changesSaved: "Takk! Endringsforslaget er lagt ved bestillingen.",
	changesSavedHint: "Vi ser over det før det vises. Fortsett gjerne med bestillingen under.",
	editChanges: "Rediger",
	billingOnFile: "Fakturainformasjon er registrert.",
	billingMissing: "Fakturainformasjon mangler.",
} as const;

export const packageCopy = {
	legend: "Stillingsannonser",
	multipleQuestion: "Vil dere bestille flere annonser?",
	yes: "Ja",
	no: "Nei",
	add: "Legg til annonse",
	remove: "Fjern",
	removeLabel: (position: number) => `Fjern annonse ${position}`,
	limit: (max: number) => `Dere kan bestille opptil ${max} annonser om gangen.`,
	total: (quantity: number) => `Totalt for ${quantity} ${quantity === 1 ? "annonse" : "annonser"}`,
	quantity: "Antall annonser",
	quantityInfo: "Antall annonser på nettsiden, ikke antall stillinger dere ansetter til.",
	startup: "Oppstartsbedrift",
	price: "Pris",
} as const;

export const listingCopy = {
	legend: (position: number) => `Annonse ${position}`,
	...LISTING_FIELD_LABELS,
	applicationUrlPlaceholder: "https://",
	typePlaceholder: "Velg ansettelsesform",
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
	ehfInvoice: "Send fakturaen som EHF",
} as const;

export const submitCopy = {
	note: "Tilleggsinformasjon (valgfritt)",
	confirmAmount: (price: string) => `Jeg bekrefter bestillingen på ${price}.`,
	honeypot: "Nettside",
	submit: "Send bestilling",
	submitting: "Sender ...",
	failed: `Beklager, noe gikk galt. Prøv igjen om litt, eller skriv til oss på ${JOB_LISTING_ORDER_EMAIL}.`,
	invalid: "Nesten der! Noen felt mangler eller må rettes. Vi har markert dem for dere.",
} as const;

export const checkEmailCopy = {
	body: (email: string) =>
		`Vi har sendt en lenke til ${email}. Trykk på den for å bekrefte, så får vi bestillingen. Finner dere den ikke? Sjekk søppelposten, eller send den på nytt.`,
} as const;

export const confirmCopy = {
	title: "Bekreft bestillingen",
	body: "Trykk på knappen, så sender vi bestillingen videre til oss i Navet.",
	button: "Bekreft bestilling",
	confirming: "Bekrefter ...",
	backToForm: "Til bestillingsskjemaet",
	retry: "Prøv igjen",
	expired: {
		title: "Lenken har gått ut",
		body: "Lenken virker i 24 timer. Send bestillingen på nytt fra skjemaet, så sender vi en ny lenke.",
	},
	invalid: {
		title: "Vi kjenner ikke igjen lenken",
		body: "Prøv å åpne lenken direkte fra e-posten. Virker den fortsatt ikke, kan dere sende bestillingen på nytt.",
	},
	error: {
		title: "Beklager, noe gikk galt",
		body: "Vi fikk ikke bekreftet bestillingen. Prøv igjen om litt, og si ifra hvis det fortsatt ikke virker.",
	},
} as const;

export const receiptCopy = {
	title: "Takk, bestillingen er bekreftet!",
	body: "Vi har sendt dere en kvittering på e-post. Nå ser vi over annonsene og publiserer dem så fort de er klare.",
	reference: "Referanse",
	company: "Bedrift",
	product: "Produkt",
	quantity: "Antall annonser",
	price: "Pris",
	contact: "Kontakt",
	listings: "Annonser",
	updateRequested: "Vi ser over endringene i bedriftsinformasjonen før de publiseres.",
	print: "Skriv ut",
	home: "Til forsiden",
	redirect: (seconds: number) => `Sender deg til forsiden om ${seconds} s`,
	feedback: "Hvordan var det å bestille? Vi blir glade for alle tips.",
	feedbackSubmit: "Send tilbakemelding",
	feedbackSending: "Sender ...",
	feedbackThanks: "Tusen takk for tilbakemeldingen!",
	feedbackFailed: "Beklager, vi fikk ikke lagret tilbakemeldingen. Prøv igjen om litt.",
} as const;
