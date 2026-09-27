import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants";
import type { BlockedReason } from "./company-application";

// Company-facing copy for the Hugin application form (/bestill-bedpres) and its receipt.
// Validation messages live in the shared schema (packages/shared/semester/application.ts).

export const COMPANY_APPLICATION_COPY = {
	title: "Søk om bedriftsarrangement",
	lede: "Det tar rundt fem minutter. Det dere skriver lagres underveis, så dere kan komme tilbake senere.",
	loading: "Laster søknadsskjemaet …",
	deadline: "Søknadsfrist",
	deadlinePassed: "Søknadsfristen var",
	lateNotice: "Vi tar fortsatt imot søknader, men kan ikke love en dato.",
	sections: {
		company: "Bedriften",
		event: "Arrangementet",
		dates: "Datoer",
		practical: "Praktisk",
		billing: "Faktura",
	},
	optional: "Valgfritt",
	yesNo: { yes: "Ja", no: "Nei" },
	/** The label of the hidden field only bots fill in. */
	honeypot: "La dette feltet stå tomt",
	company: {
		label: "Hvilken bedrift gjelder det?",
		searching: "Søker i Enhetsregisteret …",
		tooShort: "Skriv minst to tegn.",
		noHits: "Fant ingen bedrifter. Sjekk stavemåten, eller søk på organisasjonsnummer.",
		hitCount: (count: number) => `${count} treff i Enhetsregisteret`,
		source: "Hentet fra Enhetsregisteret",
		change: "Bytt",
		changeLabel: "Bytt bedrift",
		facts: { orgNumber: "Org.nr.", organizationForm: "Org.form", city: "Sted" },
		retry: "Prøv igjen",
		draftSaved: "Det du har fylt ut er lagret.",
	},
	blocked: {
		deleted: "Slettet fra registeret. Kan ikke velges.",
		bankrupt: "Konkurs. Kan ikke velges.",
		liquidation: "Under avvikling. Kan ikke velges.",
	} satisfies Record<BlockedReason, string>,
	contact: {
		label: "Kontaktperson",
		name: "Fullt navn",
		email: "E-post",
		phone: "Telefon",
	},
	eventType: {
		label: "Hva slags arrangement?",
		capped: (cap: number) => `Inntil ${cap} studenter`,
		uncapped: "Over 40 studenter",
		price: (amount: string) => `${amount} kr eks. mva.`,
	},
	students: {
		label: "Hvor mange studenter ønsker dere?",
		unreadable: "Skriv et antall, for eksempel 30 eller 20–40.",
	},
	description: {
		label: "Beskriv arrangementet",
	},
	dates: {
		label: "Hvilke datoer kan dere?",
		chosen: (chosen: number, total: number) => `${chosen} av ${total} valgt`,
		week: (week: string) => `Uke ${week}`,
		selectAll: "Velg alle",
		clear: "Nullstill valg",
		none: "Det er ingen åpne datoer i semesteret ennå. Skriv til oss, så finner vi en løsning.",
	},
	datePreferences: {
		label: "Har dere ønsker om dato?",
	},
	venue: { label: "Hvor vil dere holde arrangementet?" },
	food: {
		label: "Får studentene mat og drikke?",
		purchaser: "Hvem kjøper inn mat og drikke?",
	},
	escape: {
		label: "Vil dere bruke Escape (studentpuben)?",
		hint: "Escape har egne vilkår for alkoholservering og koster ekstra.",
	},
	billing: {
		label: "Hvordan vil dere få fakturaen?",
		emailLabel: "E-post for faktura",
		detailsLabel: "Annen fakturainformasjon",
		ehfLabel: "Send fakturaen som EHF",
	},
	additionalInfo: {
		label: "Noe dere vil legge til?",
	},
	consent: {
		label: "Vi godtar at Navet lagrer opplysningene i søknaden.",
		privacy: "Les personvernerklæringen",
		terms: "Les vilkårene",
	},
	submit: {
		idle: "Send søknad",
		busy: "Sender …",
		missing: (count: number) => `${count} felt mangler svar`,
		summary: (count: number) =>
			count === 1
				? "Søknaden ble ikke sendt. Rett opp feltet som er markert."
				: `Søknaden ble ikke sendt. Rett opp de ${count} feltene som er markert.`,
		failedTitle: "Søknaden ble ikke sendt",
	},
	closed: {
		title: "Søknadene er stengt",
		body: "Vi tar ikke imot søknader akkurat nå. Søknadene for neste semester åpner når semesteret er klart.",
		question: "Har dere spørsmål? Skriv til",
	},
	receipt: {
		title: "Søknaden er sendt",
		body: (deadline: string) =>
			`Takk! Etter fristen ${deadline} fordeler vi datoene, og bedriftskontakten tar kontakt med et tilbud.`,
		lateBody: "Takk! Vi ser på søknaden, og bedriftskontakten tar kontakt med dere.",
		keep: "Dere får ingen kopi på e-post. Ta gjerne vare på denne siden.",
		summary: "Dette sendte dere",
		wrong: "Noe som ble feil? Skriv til",
		missingTitle: "Fant ingen kvittering",
		missingBody: `Kvitteringen vises bare rett etter at søknaden er sendt. Lurer dere på om den kom fram? Skriv til ${COMPANY_CONTACT_EMAIL}.`,
		back: "Til søknadsskjemaet",
		rows: {
			company: "Bedrift",
			type: "Type",
			students: "Studenter",
			dates: "Datoer",
			venue: "Sted",
			escape: "Escape",
			invoice: "Faktura",
		},
	},
} as const;
