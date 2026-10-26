// Company-facing copy for the Hugin application form (/bestill-bedpres), the email confirmation
// (/bestill-bedpres/bekreft) and the receipt.
// Validation messages live in the shared schema (packages/shared/semester/application.ts).

export const COMPANY_APPLICATION_COPY = {
	title: "Søk om bedriftsarrangement",
	lede: "Så hyggelig at dere vil besøke studentene våre! Det tar rundt fem minutter, og det dere skriver lagres underveis, så dere kan ta en pause og komme tilbake senere.",
	loading: "Henter søknadsskjemaet …",
	deadline: "Søknadsfrist",
	deadlinePassed: "Søknadsfristen var",
	semester: {
		label: "Hvilket semester søker dere for?",
		deadline: (date: string) => `Søknadsfrist ${date}`,
		current: (name: string) =>
			`Obs: dere søker for ${name}, som allerede er i gang. Det kan bli kort tid til planlegging, og vi kan ikke love en dato, men vi gjør vårt beste for å finne en løsning.`,
	},
	lateNotice:
		"Fristen er ute, men send gjerne inn likevel! Vi kan ikke love en dato, men vi ser på alle søknadene og tar kontakt.",
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
		none: "Vi har ikke åpnet noen datoer i semesteret ennå. Skriv til oss, så finner vi en løsning sammen.",
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
		label: "Vi godtar at Navet tar vare på opplysningene i søknaden.",
		privacy: "Les personvernerklæringen",
		terms: "Les vilkårene",
	},
	submit: {
		idle: "Send søknad",
		busy: "Sender …",
		missing: (count: number) => `${count} felt mangler svar`,
		summary: (count: number) =>
			count === 1
				? "Nesten der! Ett felt mangler eller må rettes. Vi har markert det for dere."
				: `Nesten der! ${count} felt mangler eller må rettes. Vi har markert dem for dere.`,
		failedTitle: "Søknaden ble ikke sendt",
	},
	closed: {
		title: "Søknadene er stengt akkurat nå",
		body: "Vi holder på å gjøre klart neste semester. Så snart det er klart, åpner vi for søknader igjen.",
		question: "Lurer dere på noe? Vi svarer gjerne på",
		interest: {
			title: "Vil dere vite når søknadene åpner?",
			lede: "Legg igjen navn og e-post, så sier vi ifra så fort dere kan søke.",
			companyName: "Bedrift",
			email: "E-post",
			send: "Gi oss beskjed",
			busy: "Sender …",
			sent: (email: string) => `Takk! Vi sier ifra til ${email} så fort søknadene åpner.`,
			honeypot: "Ikke fyll ut dette feltet",
		},
	},
	checkEmail: {
		body: (email: string) =>
			`Vi har sendt en lenke til ${email}. Trykk på den for å bekrefte, så får vi søknaden. Finner dere den ikke? Sjekk søppelposten, eller send den på nytt.`,
	},
	confirm: {
		title: "Bekreft søknaden",
		body: "Trykk på knappen, så sender vi søknaden videre til oss i Navet.",
		button: "Bekreft søknad",
		confirming: "Bekrefter …",
		backToForm: "Til søknadsskjemaet",
		retry: "Prøv igjen",
		refusedTitle: "Søknaden ble ikke sendt",
		expired: {
			title: "Lenken har gått ut",
			body: "Send søknaden på nytt fra skjemaet, så sender vi en ny lenke.",
		},
		invalid: {
			title: "Vi kjenner ikke igjen lenken",
			body: "Har dere fått flere e-poster fra oss, virker bare lenken i den nyeste. Prøv å åpne den direkte fra e-posten. Virker den fortsatt ikke, kan dere sende søknaden på nytt.",
		},
		error: {
			title: "Beklager, noe gikk galt",
			body: "Vi fikk ikke bekreftet søknaden. Prøv igjen om litt, og si ifra hvis det fortsatt ikke virker.",
		},
	},
	receipt: {
		title: "Takk, vi har fått søknaden!",
		body: (deadline: string) =>
			`Etter fristen ${deadline} fordeler vi datoene, og så tar vi kontakt med et tilbud. Vi gleder oss!`,
		lateBody: "Vi ser på søknaden så fort vi kan og tar kontakt med dere. Vi gleder oss!",
		keep: "Lenken i e-posten viser denne kvitteringen igjen.",
		summary: "Dette sendte dere",
		wrong: "Ble noe feil, eller har dere spørsmål? Si ifra på",
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
