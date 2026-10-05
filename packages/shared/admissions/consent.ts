export const ADMISSION_CONSENT = {
	version: "admissions-2026-01",
	title: "Slik bruker vi opplysningene dine",
	description: (deletionDate: string) =>
		`Vi behandler navn, e-post, studieprogram, grad, studieår, søknadssvar, tilgjengeligheten din, eller at ingen av de foreslåtte tidene passer, eventuell intervjutid og opptaksbeslutning for å gjennomføre opptaket. Søknadsopplysningene slettes ${deletionDate}. Studentprofilen din blir ikke slettet som del av dette.`,
	label: "Jeg godtar at opplysningene over brukes til å gjennomføre opptaket.",
};
