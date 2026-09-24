export const DEGREES = {
	aarsstudium: "Årsstudium",
	bachelor: "Bachelor",
	master: "Master",
	phd: "PhD",
} as const;

export const DEGREE_TYPES = [
	DEGREES.aarsstudium,
	DEGREES.bachelor,
	DEGREES.master,
	DEGREES.phd,
] as const;

type DegreeKey = keyof typeof DEGREES;

export const degreeKey = (name: (typeof DEGREE_TYPES)[number]) =>
	(Object.keys(DEGREES) as DegreeKey[]).find((key) => DEGREES[key] === name) as DegreeKey;

export const degreeName = (key: string) => DEGREES[key as DegreeKey] ?? key;
