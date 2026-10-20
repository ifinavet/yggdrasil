import { z } from "zod";

export const WIKI_CATEGORIES = {
	start: { title: "Kom i gang", description: "Finn frem og gjennomfør din første oppgave." },
	companies: {
		title: "Bedriftssamarbeid",
		description: "Fra søknad og tilbud til et ferdig opplegg.",
	},
	events: { title: "Arrangementer", description: "Planlegg, gjennomfør og følg opp bedpress." },
	finance: { title: "Økonomi og produkter", description: "Priser, fakturering og kvitteringer." },
	members: { title: "Medlemmer og opptak", description: "Intervjuer, medlemskap og kontoer." },
	insight: { title: "Innsikt", description: "Forstå påmelding, oppmøte og historikk." },
	tools: { title: "Verktøy og rutiner", description: "Skjemaer, Slack og praktisk hjelp." },
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
export const WIKI_REVIEW_DAYS = 90;
export const WIKI_POLICY_REVIEW_DAYS = 365;
export const wikiArticleSchema = z.object({
	title: z.string().trim().min(3).max(160),
	slug: z
		.string()
		.trim()
		.min(3)
		.max(100)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Bruk små bokstaver, tall og bindestrek."),
	excerpt: z.string().trim().min(10).max(500),
	content: z.string().trim().min(10).max(80000),
	category: z.enum(WIKI_CATEGORY_KEYS),
	aliases: z.array(z.string().trim().min(1).max(80)).max(20),
	relatedSlugs: z.array(z.string().max(100)).max(12),
	facts: z.array(z.enum(WIKI_FACT_KEYS)).max(6),
	owner: z.string().trim().min(2).max(120),
	policy: z.boolean(),
});
export type WikiArticle = z.infer<typeof wikiArticleSchema>;

export function wikiReviewReasons(
	article: {
		lastCheckedAt?: number;
		reviewDueAt?: number;
		checkedSourceVersion?: string;
	},
	sourceVersion: string,
	now: number,
) {
	const reasons: string[] = [];
	if (!article.lastCheckedAt) reasons.push("Ikke kontrollert");
	else if (article.reviewDueAt !== undefined && article.reviewDueAt <= now)
		reasons.push("Tid for gjennomgang");
	if (article.checkedSourceVersion && article.checkedSourceVersion !== sourceVersion)
		reasons.push("Funksjonen er endret");
	return reasons;
}

export function searchSnippet(text: string, query: string, length = 200) {
	const terms = query.toLocaleLowerCase("nb").trim().split(/\s+/).filter(Boolean);
	const lower = text.toLocaleLowerCase("nb");
	const matches = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
	const start = matches.length ? Math.max(0, Math.min(...matches) - 45) : 0;
	return `${start ? "…" : ""}${text.slice(start, start + length).trim()}${text.length > start + length ? "…" : ""}`;
}
