import { DEGREE_TYPES, DEGREES } from "./degrees";

const { aarsstudium, bachelor, master, phd } = DEGREES;
const ALL = DEGREE_TYPES;
const STUDY = [bachelor, master, phd] as const;
const GRADUATE = [master, phd] as const;
const ONE_YEAR = [aarsstudium] as const;

export const PROGRAM_DEGREES = {
	"Informatikk: programmering og systemarkitektur": STUDY,
	"Informatikk: design, bruk og interaksjon": STUDY,
	"Informatikk: digital økonomi og ledelse": STUDY,
	"Informatikk: språkteknologi": STUDY,
	"Informatikk: maskinlæring og kunstig intelligens": STUDY,
	"Informatikk: robotikk og intelligente systemer": STUDY,
	"Elektronikk, informatikk og teknologi": STUDY,
	"Matematikk med informatikk": STUDY,
	Informasjonssikkerhet: GRADUATE,
	"Computational science": GRADUATE,
	"Data science": GRADUATE,
	"Entreprenørskap og innovasjonsledelse": GRADUATE,
	"Digitalisering i helsesektoren": GRADUATE,
	"Informatikk (årsenhet)": ONE_YEAR,
	"IT-arkitektur (årsenhet)": ONE_YEAR,
	"Enkeltemne(r)": ALL,
} as const satisfies Record<string, readonly (typeof DEGREE_TYPES)[number][]>;

export type StudyProgram = keyof typeof PROGRAM_DEGREES;

export const STUDY_PROGRAMS = Object.keys(PROGRAM_DEGREES) as [StudyProgram, ...StudyProgram[]];
