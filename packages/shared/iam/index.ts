import { z } from "zod";

const LETTER_REPLACEMENTS: Record<string, string> = { æ: "ae", ø: "o", å: "a", ß: "ss" };

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

export function domainOf(email: string) {
	return normalizeEmail(email).split("@")[1] ?? "";
}

export function isUioEmail(email: string) {
	const domain = domainOf(email);
	return domain === "uio.no" || domain.endsWith(".uio.no");
}

function slug(name: string) {
	return name
		.toLowerCase()
		.replaceAll(/[æøåß]/g, (letter) => LETTER_REPLACEMENTS[letter] ?? letter)
		.normalize("NFKD")
		.replaceAll(/\p{M}/gu, "")
		.split(/[^a-z0-9]+/)
		.filter(Boolean)
		.join(".");
}

export function suggestWorkspaceEmail(firstName: string, lastName: string, domain: string) {
	const local = [slug(firstName), slug(lastName)].filter(Boolean).join(".");
	return local ? `${local}@${domain}` : "";
}

const requiredName = (message: string) => z.string().trim().min(1, message).max(100, message);

const emailAddress = () =>
	z.string().trim().toLowerCase().pipe(z.email("Skriv en gyldig e-postadresse."));

export function onboardingSchema(domain: string | null) {
	return z.object({
		firstName: requiredName("Skriv fornavnet."),
		lastName: requiredName("Skriv etternavnet."),
		uioEmail: emailAddress().refine(isUioEmail, "Bruk UiO-adressen, den som slutter på uio.no."),
		workspaceEmail: emailAddress().refine(
			(email) => domain === null || domainOf(email) === domain,
			domain ? `Adressen må slutte på @${domain}.` : "Skriv en gyldig e-postadresse.",
		),
		group: z.string().trim().min(1, "Velg en gruppe."),
	});
}

export type OnboardingInput = z.input<ReturnType<typeof onboardingSchema>>;
