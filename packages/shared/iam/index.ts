import { z } from "zod";

import { asciiSlug } from "../utils/slug";

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

export function suggestWorkspaceEmail(firstName: string, lastName: string, domain: string) {
	const local = [asciiSlug(firstName, "."), asciiSlug(lastName, ".")].filter(Boolean).join(".");
	return local ? `${local}@${domain}` : "";
}

const requiredName = (message: string) => z.string().trim().min(1, message).max(100, message);

const emailAddress = () =>
	z.string().trim().toLowerCase().pipe(z.email("Skriv en gyldig e-postadresse."));

export const uioEmailSchema = emailAddress().refine(
	isUioEmail,
	"Bruk UiO-adressen, den som slutter på uio.no.",
);

export function onboardingSchema(domain: string | null) {
	return z.object({
		firstName: requiredName("Skriv fornavnet."),
		lastName: requiredName("Skriv etternavnet."),
		uioEmail: uioEmailSchema,
		workspaceEmail: emailAddress().refine(
			(email) => domain === null || domainOf(email) === domain,
			domain ? `Adressen må slutte på @${domain}.` : "Skriv en gyldig e-postadresse.",
		),
		group: z.string().trim().min(1, "Velg en gruppe."),
	});
}

export type OnboardingInput = z.input<ReturnType<typeof onboardingSchema>>;
