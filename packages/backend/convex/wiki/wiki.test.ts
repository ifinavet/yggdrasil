import { wikiArticleSchema } from "@workspace/shared/wiki";
import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertUser,
	present as required,
	setupAdminAndEditor,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import { HANDBOOK_ARTICLES } from "./content";
import { indexedArticle, plainText } from "./helpers";

const article = {
	title: "Oppmøte på bedpress",
	slug: "test-oppmote",
	excerpt: "Registrer oppmøte og rett eventuelle feil.",
	content: "<h2>Fremgangsmåte</h2><p>Bruk deltakerlisten og skann studentens kode.</p>",
	category: "events" as const,
	aliases: ["bedpres", "prikksystem"],
	facts: ["attendance" as const],
};
const paginationOpts = { numItems: 10, cursor: null };
async function setupArticle() {
	const env = await setupAdminAndEditor();
	const id = await env.t.run((ctx) =>
		ctx.db.insert("resources", {
			...indexedArticle(article),
			published: true,
			updatedAt: 1,
			editVersion: 1,
		}),
	);
	return { ...env, id };
}
const update = {
	title: article.title,
	excerpt: article.excerpt,
	content: article.content,
	icon: "book",
	published: true,
};

describe("handbook search", () => {
	it("searches body and aliases and paginates", async () => {
		const { admin, t } = await setupArticle();
		for (const query of ["deltakerlisten", "prikksystem", "bedpres"]) {
			expect(
				(await admin.query(api.wiki.queries.browse, { query, paginationOpts })).page[0]?.slug,
			).toBe(article.slug);
		}
		await t.run(async (ctx) => {
			for (let index = 0; index < 3; index++)
				await ctx.db.insert("resources", {
					...indexedArticle({ ...article, slug: `next-${index}` }),
					published: true,
					updatedAt: 1,
				});
		});
		const first = await admin.query(api.wiki.queries.browse, {
			query: "",
			paginationOpts: { numItems: 2, cursor: null },
		});
		const second = await admin.query(api.wiki.queries.browse, {
			query: "",
			paginationOpts: { numItems: 2, cursor: first.continueCursor },
		});
		expect(new Set([...first.page, ...second.page].map((row) => row._id)).size).toBe(4);
	});
	it("excludes unpublished and unimported resources", async () => {
		const { admin, t, id } = await setupArticle();
		await t.run(async (ctx) => {
			await ctx.db.patch(id, { published: false });
			await ctx.db.insert("resources", {
				title: "Legacy",
				excerpt: "En eldre ressurs",
				content: "<p>Original</p>",
				published: true,
				updatedAt: 1,
			});
		});
		expect(
			(await admin.query(api.wiki.queries.browse, { query: "", paginationOpts })).page,
		).toEqual([]);
		expect(await admin.query(api.wiki.queries.get, { slug: article.slug })).toBeNull();
	});
	it("allows internal readers and rejects visitors and students", async () => {
		const { t } = await setupArticle();
		await expect(t.query(api.wiki.queries.get, { slug: article.slug })).rejects.toThrow(
			"Unauthorized",
		);
		const user = await insertUser(t, "student@test.invalid");
		const student = asUser(t, user);
		await expect(
			student.query(api.wiki.queries.browse, { query: "", paginationOpts }),
		).rejects.toThrow("Unauthorized");
		await grantRole(t, user._id, "internal");
		expect((await student.query(api.wiki.queries.get, { slug: article.slug }))?.title).toBe(
			article.title,
		);
	});
});
describe("existing resource editor integration", () => {
	it("makes legacy creation searchable immediately with canonical metadata", async () => {
		const { admin, t } = await setupAdminAndEditor();
		await admin.mutation(api.pages.mutations.createResource, { ...update, gradient: "blue" });
		const result = required(
			(await admin.query(api.wiki.queries.browse, { query: "deltakerlisten", paginationOpts }))
				.page[0],
		);
		expect(result.slug).toBe(`ressurs-${result._id}`);
		const created = required(await admin.query(api.wiki.queries.get, { slug: result.slug }));
		expect(created.category).toBe("tools");
		const history = await t.run((ctx) => ctx.db.query("wikiRevisions").collect());
		expect(history).toHaveLength(1);
		expect(history[0]?.article.content).toBe(article.content);
	});
	it("reindexes existing edits and preserves category, aliases, facts and prior content", async () => {
		const { admin, t, id } = await setupArticle();
		// The first archived snapshot normally comes from migration or creation.
		await t.run((ctx) =>
			ctx.db.insert("wikiRevisions", {
				resourceId: id,
				article,
				number: 1,
				action: "Opprettet",
				createdAt: 1,
			}),
		);
		await admin.mutation(api.pages.mutations.updateResource, {
			...update,
			id,
			content: "<p>Ny rutine for reservetilbud.</p>",
		});
		const saved = required(await admin.query(api.wiki.queries.get, { slug: article.slug }));
		expect(saved).toMatchObject({
			category: "events",
			aliases: article.aliases,
			facts: article.facts,
			editVersion: 2,
		});
		expect(
			(await admin.query(api.wiki.queries.browse, { query: "reservetilbud", paginationOpts })).page,
		).toHaveLength(1);
		expect(
			(await admin.query(api.wiki.queries.browse, { query: "deltakerlisten", paginationOpts }))
				.page,
		).toHaveLength(0);
		const history = await t.run((ctx) => ctx.db.query("wikiRevisions").collect());
		expect(history.map((row) => row.article.content)).toEqual([article.content, saved.content]);
		await admin.mutation(api.pages.mutations.updateResource, { ...update, id, published: false });
		expect(await admin.query(api.wiki.queries.get, { slug: article.slug })).toBeNull();
	});
	it("sanitizes saved HTML and excludes script bodies from search", async () => {
		const { admin, id } = await setupArticle();
		await admin.mutation(api.pages.mutations.updateResource, {
			...update,
			id,
			content:
				'<h2>Hei</h2><script>privateToken</script><p onclick="alert(1)">Tekst</p><a href="javascript:alert(1)">Lenke</a>',
		});
		const saved = required(await admin.query(api.wiki.queries.get, { slug: article.slug }));
		expect(saved.content).not.toMatch(/script|onclick|javascript|privateToken/);
		expect(plainText("<p>A &amp; B</p><p>C</p><script>hidden</script>")).toBe("A & B C");
	});
});
describe("migration and live facts", () => {
	it.each(["Hvordan holde bedpres", "Hvordan holde bedpress"])(
		"replaces outdated %s while preserving its ID, original text and unrelated resources",
		async (title) => {
			const { admin, t } = await setupAdminAndEditor();
			const oldContent =
				'<p>Send påminnelse med BCC.</p><p><a href="https://example.test/rapportmal">Rapportmal</a></p>';
			const policy = "<h2>Formål</h2><p>Original policy skal bevares &amp; leses.</p>";
			const ids = await t.run(async (ctx) => [
				await ctx.db.insert("resources", {
					title,
					content: oldContent,
					excerpt: "En eldre guide",
					published: true,
					favorite: true,
					updatedAt: 1,
				}),
				await ctx.db.insert("resources", {
					title: "Rettningslinjer for Interne",
					content: policy,
					excerpt: "Gjeldende policy",
					published: true,
					updatedAt: 2,
				}),
			]);
			await admin.mutation(api.wiki.migration.initialize, {});
			await admin.mutation(api.wiki.migration.initialize, {});
			const bedpress = required(
				await admin.query(api.wiki.queries.get, { slug: "holde-bedpress" }),
			);
			expect(bedpress._id).toBe(ids[0]);
			expect(bedpress.favorite).toBe(true);
			expect(bedpress).toMatchObject(
				required(HANDBOOK_ARTICLES.find((entry) => entry.slug === "holde-bedpress")),
			);
			expect(bedpress.content).not.toContain("BCC");
			expect(
				(await admin.query(api.wiki.queries.browse, { query: "Rapportmal", paginationOpts })).page,
			).toEqual([]);
			expect(
				(await admin.query(api.wiki.queries.browse, { query: "Utlegg", paginationOpts })).page.map(
					(row) => row._id,
				),
			).toEqual([ids[0]]);
			expect(
				(await admin.query(api.wiki.queries.get, { slug: "retningslinjer-interne" }))?.content,
			).toBe(policy);
			const history = await t.run((ctx) =>
				ctx.db
					.query("wikiRevisions")
					.withIndex("by_resourceId_and_number", (q) => q.eq("resourceId", bedpress._id))
					.collect(),
			);
			expect(history).toHaveLength(2);
			expect(history.find((row) => row.number === 0)?.article.content).toBe(oldContent);
			expect(await t.run((ctx) => ctx.db.query("resources").collect())).toHaveLength(
				HANDBOOK_ARTICLES.length + 1,
			);
		},
	);
	it("archives duplicate old bedpress guides without replacing an existing handbook article", async () => {
		const { admin, t } = await setupAdminAndEditor();
		await admin.mutation(api.wiki.migration.initialize, {});
		const current = required(await admin.query(api.wiki.queries.get, { slug: "holde-bedpress" }));
		const oldContent = "<p>Lag et eget oppmøteark.</p>";
		const duplicateId = await t.run((ctx) =>
			ctx.db.insert("resources", {
				title: "Hvordan holde bedpres",
				content: oldContent,
				excerpt: "En eldre kopi",
				published: true,
				updatedAt: 1,
			}),
		);
		await admin.mutation(api.wiki.migration.initialize, {});
		await admin.mutation(api.wiki.migration.initialize, {});
		expect(await admin.query(api.wiki.queries.get, { slug: "holde-bedpress" })).toEqual(current);
		expect(await t.run((ctx) => ctx.db.get(duplicateId))).toMatchObject({
			content: oldContent,
			published: false,
		});
		expect(
			(await admin.query(api.wiki.queries.browse, { query: "oppmøteark", paginationOpts })).page,
		).toEqual([]);
	});
	it("validates all initial articles and their internal links", () => {
		const slugs = new Set(HANDBOOK_ARTICLES.map((row) => row.slug));
		expect(slugs.size).toBe(HANDBOOK_ARTICLES.length);
		for (const entry of HANDBOOK_ARTICLES) {
			expect(wikiArticleSchema.safeParse(entry).success, entry.slug).toBe(true);
			for (const link of entry.content.matchAll(/href="\/wiki\/([^"]+)"/g))
				expect(slugs.has(required(link[1])), entry.slug).toBe(true);
		}
	});
	it("reads updated product data and handles missing published forms", async () => {
		const { admin, t } = await setupAdminAndEditor();
		expect((await admin.query(api.wiki.facts.get, { key: "forms" })).note).toContain(
			"Ingen publiserte",
		);
		const id = await t.run((ctx) =>
			ctx.db.insert("products", {
				name: "Testpakke",
				shortDescription: "Test",
				longDescription: "Test",
				category: "event",
				unitPriceOre: 10000,
				vatRate: 25,
				sortOrder: 1,
				active: true,
			}),
		);
		const before = await admin.query(api.wiki.facts.get, { key: "products" });
		await t.run((ctx) => ctx.db.patch(id, { unitPriceOre: 20000 }));
		const after = await admin.query(api.wiki.facts.get, { key: "products" });
		expect(before.rows[0]?.value).not.toBe(after.rows[0]?.value);
	});
});
