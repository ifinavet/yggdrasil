import type { api } from "@workspace/backend/convex/api";
import type { FunctionReturnType } from "convex/server";

// Companies as Enhetsregisteret (Brønnøysund) lists them, shared by the Hugin company forms.

/** One company from the Enhetsregisteret search. */
export type RegistryHit = FunctionReturnType<
	typeof api.semesterPlanning.registry.actions.searchCompanies
>[number];

export type BlockedReason = NonNullable<RegistryHit["blockedReason"]>;

/** «924 773 189», an organization number the way brreg writes it. */
export function formatOrgNumber(orgNumber: string): string {
	return orgNumber.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
}

const LOWERCASE_PLACE_WORDS = new Set(["i", "på", "og"]);

/** A place name from Enhetsregisteret («MO I RANA») the way people write it («Mo i Rana»). */
export function placeName(city: string): string {
	return city
		.toLocaleLowerCase("nb")
		.split(" ")
		.map((word, index) =>
			index > 0 && LOWERCASE_PLACE_WORDS.has(word)
				? word
				: word.replace(
						/(^|-)(\p{L})/gu,
						(_, dash: string, letter: string) => dash + letter.toLocaleUpperCase("nb"),
					),
		)
		.join(" ");
}

/** «924 773 189 · AS · Oslo»: the organization number and what else is known about the company. */
export function hitMeta(hit: {
	orgNumber: string;
	organizationForm?: string;
	city?: string;
}): string {
	return [formatOrgNumber(hit.orgNumber), hit.organizationForm, hit.city && placeName(hit.city)]
		.filter(Boolean)
		.join(" · ");
}
