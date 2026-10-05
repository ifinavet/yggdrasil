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

export type Degree = (typeof DEGREE_TYPES)[number];

export const DEGREE_YEARS: Record<Degree, { first: number; last: number }> = {
	[DEGREES.aarsstudium]: { first: 1, last: 1 },
	[DEGREES.bachelor]: { first: 1, last: 3 },
	[DEGREES.master]: { first: 4, last: 5 },
	[DEGREES.phd]: { first: 1, last: 5 },
};

export const NEXT_DEGREE: Partial<Record<Degree, Degree>> = {
	[DEGREES.bachelor]: DEGREES.master,
};

type DegreeKey = keyof typeof DEGREES;

export const degreeKey = (name: (typeof DEGREE_TYPES)[number]) =>
	(Object.keys(DEGREES) as DegreeKey[]).find((key) => DEGREES[key] === name) as DegreeKey;

export const degreeName = (key: string) => DEGREES[key as DegreeKey] ?? key;
