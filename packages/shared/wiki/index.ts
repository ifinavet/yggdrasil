import { z } from "zod";

export const WIKI_CATEGORIES = {
	start: { title: "Kom i gang" },
	companies: { title: "Bedriftssamarbeid" },
	events: { title: "Arrangementer" },
	finance: { title: "Økonomi og produkter" },
	members: { title: "Medlemmer og opptak" },
	insight: { title: "Innsikt" },
	tools: { title: "Verktøy og rutiner" },
} as const;
export type WikiCategory = keyof typeof WIKI_CATEGORIES;
export const WIKI_CATEGORY_KEYS = Object.keys(WIKI_CATEGORIES) as [WikiCategory, ...WikiCategory[]];
export const WIKI_FACTS = {
	products: "Aktive produkter og priser",
	feedback: "Tilbakemeldinger og frister",
	attendance: "Oppmøte og prikker",
	checklist: "Arrangementets sjekkliste",
	slack: "Tidspunkter for oppfølging",
	forms: "Publiserte tilbakemeldingsskjemaer",
} as const;
export type WikiFact = keyof typeof WIKI_FACTS;
export const WIKI_FACT_KEYS = Object.keys(WIKI_FACTS) as [WikiFact, ...WikiFact[]];
export const wikiArticleSchema = z.object({
	title: z.string().trim().min(2).max(160),
	slug: z
		.string()
		.trim()
		.min(3)
		.max(100)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Bruk små bokstaver, tall og bindestrek."),
	excerpt: z.string().trim().min(10).max(500),
	content: z.string().trim().min(1).max(80000),
	category: z.enum(WIKI_CATEGORY_KEYS),
	aliases: z.array(z.string().trim().min(1).max(80)).max(20),
	facts: z.array(z.enum(WIKI_FACT_KEYS)).max(6),
});
export type WikiArticle = z.infer<typeof wikiArticleSchema>;
