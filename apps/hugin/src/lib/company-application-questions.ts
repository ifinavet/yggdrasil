// Company-facing copy for the Hugin application form (/bestill-bedpres), the email confirmation
// (/bestill-bedpres/bekreft) and the receipt.
// Validation messages live in the shared schema (packages/shared/semester/application.ts).

export const COMPANY_APPLICATION_COPY = {
	title: "Søk om bedriftsarrangement",
	lede: "Det tar rundt fem minutter. Det dere skriver lagres underveis, så dere kan komme tilbake senere.",
	loading: "Laster søknadsskjemaet …",
	deadline: "Søknadsfrist",
	deadlinePassed: "Søknadsfristen var",
	semester: {
		label: "Hvilket semester søker dere for?",
		deadline: (date: string) => `Søknadsfrist ${date}`,
		current: (name: string) =>
			`Obs: dere søker for ${name}, som allerede er i gang. Det kan bli kort tid til planlegging, og vi kan ikke love en dato.`,
	},
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
	},
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
		interest: {
			title: "Vil dere vite når søknadene åpner?",
			lede: "Legg igjen navn og e-post, så gir vi beskjed når dere kan søke.",
			companyName: "Bedrift",
			email: "E-post",
			send: "Gi oss beskjed",
			busy: "Sender …",
			sent: (email: string) => `Takk! Vi gir beskjed til ${email} når søknadene åpner.`,
			honeypot: "Ikke fyll ut dette feltet",
		},
	},
	checkEmail: {
		body: (email: string) =>
			`Vi har sendt en lenke til ${email}. Søknaden sendes først når du har bekreftet den.`,
	},
	confirm: {
		title: "Bekreft søknaden",
		body: "Trykk på knappen for å sende søknaden til Navet.",
		button: "Bekreft søknad",
		confirming: "Bekrefter …",
		backToForm: "Til søknadsskjemaet",
		retry: "Prøv igjen",
		refusedTitle: "Søknaden ble ikke sendt",
		expired: {
			title: "Lenken har utløpt",
			body: "Send søknaden på nytt fra skjemaet.",
		},
		invalid: {
			title: "Lenken er ugyldig",
			body: "Åpne lenken fra e-posten, eller send en ny søknad.",
		},
		error: {
			title: "Noe gikk galt",
			body: "Vi kunne ikke bekrefte søknaden. Prøv igjen om litt.",
		},
	},
	receipt: {
		title: "Søknaden er sendt",
		body: (deadline: string) =>
			`Takk! Etter fristen ${deadline} fordeler vi datoene, og bedriftskontakten tar kontakt med et tilbud.`,
		lateBody: "Takk! Vi ser på søknaden, og bedriftskontakten tar kontakt med dere.",
		keep: "Lenken i e-posten viser denne kvitteringen i 24 timer. Ta gjerne vare på siden.",
		summary: "Dette sendte dere",
		wrong: "Noe som ble feil? Skriv til",
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
