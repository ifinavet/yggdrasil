export const DEV_AUTH_ISSUER = "https://dev-auth.yggdrasil.local";

export const DEV_AUTH_AUDIENCE = "convex";

export const DEV_AUTH_KEY_ID = "yggdrasil-dev-auth";

export const DEV_AUTH_TOKEN_TTL_SECONDS = 60 * 60;

export const DEV_AUTH_SESSION_TTL_SECONDS = 60 * 60 * 12;

export const DEV_AUTH_COOKIE = "yggdrasil-dev-user";

export type DevUser = {
	readonly externalId: string;
	readonly firstName: string;
	readonly lastName: string;
	readonly email: string;
	readonly role: "super-admin" | "editor" | null;
	readonly studyProgram: string;
	readonly degree: "Årsstudium" | "Bachelor" | "Master" | "PhD";
	readonly year: number;
};

export const DEV_USERS: readonly DevUser[] = [
	{
		externalId: "dev_super_admin",
		firstName: "Ada",
		lastName: "Superadmin",
		email: "ada@example.com",
		role: "super-admin",
		studyProgram: "Informatikk: programmering og systemarkitektur",
		degree: "Master",
		year: 4,
	},
	{
		externalId: "dev_editor",
		firstName: "Even",
		lastName: "Redaktør",
		email: "even@example.com",
		role: "editor",
		studyProgram: "Informatikk: design, bruk og interaksjon",
		degree: "Bachelor",
		year: 3,
	},
	{
		externalId: "dev_student",
		firstName: "Siri",
		lastName: "Student",
		email: "siri@example.com",
		role: null,
		studyProgram: "Informatikk: maskinlæring og kunstig intelligens",
		degree: "Bachelor",
		year: 1,
	},
];
