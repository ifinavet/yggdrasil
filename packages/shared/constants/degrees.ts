export const DEGREES = {
	aarsstudium: "Årsstudium",
	bachelor: "Bachelor",
	master: "Master",
	phd: "PhD",
	ukjent: "Ukjent",
} as const;

export const DEGREE_TYPES = [
	DEGREES.aarsstudium,
	DEGREES.bachelor,
	DEGREES.master,
	DEGREES.phd,
] as const;

type DegreeKey = keyof typeof DEGREES;

export const degreeKey = (name: string) =>
	(Object.keys(DEGREES) as DegreeKey[]).find((key) => DEGREES[key] === name) ?? "ukjent";

export const degreeName = (key: string) => DEGREES[key as DegreeKey] ?? key;
