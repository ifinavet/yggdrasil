import { DAY_MS } from "@workspace/shared/time";
import { wikiArticleSchema, wikiReviewReasons } from "@workspace/shared/wiki";
import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertUser, setupAdminAndEditor } from "../../test/fixtures";
import { api } from "../_generated/api";
import { HANDBOOK_ARTICLES } from "./content";
import { plainText, sourceInfo } from "./helpers";

const article = {
	title: "Oppmøte på bedpress",
	slug: "test-oppmote",
	excerpt: "Registrer oppmøte og rett eventuelle feil.",
	content: "<h2>Fremgangsmåte</h2><p>Bruk deltakerlisten og skann studentens kode.</p>",
	category: "events" as const,
	aliases: ["bedpres", "prikksystem"],
	relatedSlugs: [],
	facts: ["attendance" as const],
	owner: "Arrangementsansvarlig",
	policy: false,
};

function required<T>(value: T | null | undefined): T {
	if (value === undefined || value === null) throw new Error("Expected test data");
	return value;
}

const paginationOpts = { numItems: 10, cursor: null };
async function setupArticle() {
	const env = await setupAdminAndEditor();
	const result = await env.admin.mutation(api.wiki.mutations.save, {
		article,
		expectedVersion: 0,
		publish: true,
	});
	return { ...env, ...result };
}

describe("handbook publication and history", () => {
	it("separates drafts from published content and search, and rejects stale edits", async () => {
		const { admin, resourceId, editVersion } = await setupArticle();
		const draft = {
			...article,
			title: "Helt nytt utkast",
			content: "<p>Hemmeligutkast er foreløpig.</p>",
		};
		await admin.mutation(api.wiki.mutations.save, {
			resourceId,
			article: draft,
			expectedVersion: editVersion,
			publish: false,
		});
		expect((await admin.query(api.wiki.queries.get, { slug: article.slug }))?.title).toBe(
			article.title,
		);
		expect((await admin.query(api.wiki.queries.edit, { slug: article.slug }))?.article.title).toBe(
			draft.title,
		);
		expect(
			(await admin.query(api.wiki.queries.browse, { query: "Hemmeligutkast", paginationOpts }))
				.page,
		).toHaveLength(0);
		await expect(
			admin.mutation(api.wiki.mutations.save, {
				resourceId,
				article,
				expectedVersion: editVersion,
				publish: true,
			}),
		).rejects.toThrow("endret av noen andre");
		await admin.mutation(api.wiki.mutations.save, {
			resourceId,
			article: draft,
			expectedVersion: editVersion + 1,
			publish: true,
		});
		expect(
			(await admin.query(api.wiki.queries.browse, { query: "Hemmeligutkast", paginationOpts }))
				.page,
		).toHaveLength(1);
		expect(
			(await admin.query(api.wiki.queries.history, { resourceId, paginationOpts })).page.map(
				(item) => item.action,
			),
		).toEqual(["Publisert", "Utkast lagret", "Publisert"]);
	});
	it("searches body and aliases, filters categories and paginates", async () => {
		const { admin } = await setupArticle();
		for (const query of ["deltakerlisten", "prikksystem", "bedpres"]) {
			expect(
				(await admin.query(api.wiki.queries.browse, { query, paginationOpts })).page[0]?.slug,
			).toBe(article.slug);
		}
		expect(
			(
				await admin.query(api.wiki.queries.browse, {
					query: "deltakerlisten",
					category: "finance",
					paginationOpts,
				})
			).page,
		).toEqual([]);
		for (let index = 0; index < 3; index++)
			await admin.mutation(api.wiki.mutations.save, {
				article: { ...article, slug: `next-article-${index}` },
				expectedVersion: 0,
				publish: true,
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
	it("keeps draft-only articles out of normal search", async () => {
		const { admin } = await setupAdminAndEditor();
		await admin.mutation(api.wiki.mutations.save, { article, expectedVersion: 0, publish: false });
		expect(
			(await admin.query(api.wiki.queries.browse, { query: "", paginationOpts })).page,
		).toEqual([]);
		expect(
			(
				await admin.query(api.wiki.queries.reviewQueue, {
					status: "draft",
					now: Date.now(),
					paginationOpts,
				})
			).page,
		).toHaveLength(1);
	});
	it("restores as a draft and preserves the draft it replaces in history", async () => {
		const { admin, resourceId } = await setupArticle();
		const history = await admin.query(api.wiki.queries.history, { resourceId, paginationOpts });
		const changed = { ...article, content: "<p>Denne nye teksten skal også bevares.</p>" };
		await admin.mutation(api.wiki.mutations.save, {
			resourceId,
			article: changed,
			expectedVersion: 1,
			publish: false,
		});
		await admin.mutation(api.wiki.mutations.restore, {
			revisionId: required(history.page[0])._id,
			expectedVersion: 2,
		});
		expect(
			(await admin.query(api.wiki.queries.edit, { slug: article.slug }))?.article.content,
		).toBe(article.content);
		const after = await admin.query(api.wiki.queries.history, { resourceId, paginationOpts });
		expect(after.page.some((row) => row.article.content === changed.content)).toBe(true);
		expect((await admin.query(api.wiki.queries.get, { slug: article.slug }))?.content).toBe(
			article.content,
		);
	});
	it("rejects duplicate and changed slugs, reserved routes and invalid input", async () => {
		const { admin, resourceId } = await setupArticle();
		await expect(
			admin.mutation(api.wiki.mutations.save, { article, expectedVersion: 0, publish: true }),
		).rejects.toThrow("Adressen brukes allerede");
		await expect(
			admin.mutation(api.wiki.mutations.save, {
				resourceId,
				article: { ...article, slug: "changed-path" },
				expectedVersion: 1,
				publish: true,
			}),
		).rejects.toThrow("kan ikke endres");
		await expect(
			admin.mutation(api.wiki.mutations.save, {
				article: { ...article, slug: "review" },
				expectedVersion: 0,
				publish: true,
			}),
		).rejects.toThrow("reservert");
		await expect(
			admin.mutation(api.wiki.mutations.save, {
				article: { ...article, title: "" },
				expectedVersion: 0,
				publish: true,
			}),
		).rejects.toThrow();
	});
	it("sanitizes editor HTML without executing or indexing script bodies", async () => {
		const { admin } = await setupAdminAndEditor();
		await admin.mutation(api.wiki.mutations.save, {
			article: {
				...article,
				content:
					'<h2>Hei</h2><script>privateToken</script><p onclick="alert(1)">Tekst</p><a href="javascript:alert(1)">Lenke</a>',
			},
			expectedVersion: 0,
			publish: true,
		});
		const saved = await admin.query(api.wiki.queries.get, { slug: article.slug });
		expect(saved?.content).not.toMatch(/script|onclick|javascript|privateToken/);
		expect(plainText("<p>A &amp; B</p><p>C</p><script>hidden</script>")).toBe("A & B C");
	});
});

describe("review and personal state", () => {
	it("keeps bookmarks personal and idempotent", async () => {
		const { admin, editor, resourceId } = await setupArticle();
		await admin.mutation(api.wiki.mutations.bookmark, { resourceId, saved: true });
		await admin.mutation(api.wiki.mutations.bookmark, { resourceId, saved: true });
		expect((await admin.query(api.wiki.queries.home, {})).bookmarks).toHaveLength(1);
		expect((await editor.query(api.wiki.queries.home, {})).bookmarks).toHaveLength(0);
		await admin.mutation(api.wiki.mutations.bookmark, { resourceId, saved: false });
		expect((await admin.query(api.wiki.queries.home, {})).bookmarks).toHaveLength(0);
	});
	it("requires explicit review and rejects checking a different source version", async () => {
		const { admin, resourceId } = await setupArticle();
		await expect(
			admin.mutation(api.wiki.mutations.check, {
				resourceId,
				expectedVersion: 1,
				sourceVersion: "old",
			}),
		).rejects.toThrow("Funksjonen er endret");
		await admin.mutation(api.wiki.mutations.check, {
			resourceId,
			expectedVersion: 1,
			sourceVersion: "editorial",
		});
		const checked = await admin.query(api.wiki.queries.get, { slug: article.slug });
		expect(checked?.reviewDueAt).toBe(required(checked?.lastCheckedAt) + 90 * DAY_MS);
		await admin.query(api.wiki.facts.get, { key: "attendance" });
		expect((await admin.query(api.wiki.queries.get, { slug: article.slug }))?.lastCheckedAt).toBe(
			checked?.lastCheckedAt,
		);
		await admin.mutation(api.wiki.mutations.save, {
			resourceId,
			article,
			expectedVersion: 2,
			publish: true,
		});
		expect(
			(await admin.query(api.wiki.queries.get, { slug: article.slug }))?.lastCheckedAt,
		).toBeUndefined();
	});
	it("flags source drift and overdue policy reviews without rewriting prose", async () => {
		const { admin, resourceId, t } = await setupArticle();
		await t.run((ctx) =>
			ctx.db.patch(resourceId, {
				lastCheckedAt: 1000,
				checkedSourceVersion: "outdated-code",
				reviewDueAt: 1001,
			}),
		);
		const queue = await admin.query(api.wiki.queries.reviewQueue, {
			status: "published",
			now: 1002,
			paginationOpts,
		});
		expect(queue.page[0]?.reasons).toEqual(["Tid for gjennomgang", "Funksjonen er endret"]);
		expect(wikiReviewReasons({}, "editorial", 0)).toEqual(["Ikke kontrollert"]);
	});
	it("tracks and resolves reports against the reported revision", async () => {
		const { admin, resourceId } = await setupArticle();
		await admin.mutation(api.wiki.mutations.report, {
			resourceId,
			message: "Knappen har fått nytt navn.",
		});
		const reports = await admin.query(api.wiki.queries.reports, { paginationOpts });
		expect(reports.page[0]?.revision).toBe(1);
		await admin.mutation(api.wiki.mutations.resolveReport, {
			reportId: required(reports.page[0])._id,
		});
		expect((await admin.query(api.wiki.queries.reports, { paginationOpts })).page).toHaveLength(0);
	});
	it("lets internals read and edit, but rejects visitors and ordinary student accounts", async () => {
		const { t, resourceId } = await setupArticle();
		await expect(t.query(api.wiki.queries.get, { slug: article.slug })).rejects.toThrow(
			"Unauthorized",
		);
		const user = await insertUser(t, "student@test.invalid");
		const student = asUser(t, user);
		await expect(
			student.query(api.wiki.queries.browse, { query: "", paginationOpts }),
		).rejects.toThrow("Unauthorized");
		await expect(
			student.mutation(api.wiki.mutations.bookmark, { resourceId, saved: true }),
		).rejects.toThrow("Unauthorized");
		await grantRole(t, user._id, "internal");
		expect((await student.query(api.wiki.queries.get, { slug: article.slug }))?.title).toBe(
			article.title,
		);
		await student.mutation(api.wiki.mutations.save, {
			resourceId,
			article,
			expectedVersion: 1,
			publish: false,
		});
	});
});

describe("migration and retirement", () => {
	it("preserves IDs and policy HTML, archives the old bedpress, and is safe to repeat", async () => {
		const { admin, t } = await setupAdminAndEditor();
		const oldContent = "<h2>Før arrangementet</h2><p>Lag et Google-sheet for oppmøte.</p>";
		const policy = "<h2>Formål</h2><p>Original policy skal bevares &amp; leses.</p>";
		const ids = await t.run(async (ctx) => [
			await ctx.db.insert("resources", {
				title: "Hvordan holde bedpress",
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
		const bedpress = await admin.query(api.wiki.queries.get, { slug: "holde-bedpress" });
		expect(bedpress?._id).toBe(ids[0]);
		expect(bedpress?.favorite).toBe(true);
		expect(bedpress?.content).not.toContain("Lag et Google-sheet");
		expect(
			(await admin.query(api.wiki.queries.get, { slug: "retningslinjer-interne" }))?.content,
		).toBe(policy);
		const history = await admin.query(api.wiki.queries.history, {
			resourceId: required(ids[0]),
			paginationOpts,
		});
		expect(history.page).toHaveLength(2);
		expect(history.page.find((row) => row.number === 0)?.article.content).toBe(oldContent);
		const all = await t.run((ctx) => ctx.db.query("resources").collect());
		expect(all).toHaveLength(HANDBOOK_ARTICLES.length + 1);
		await expect(
			admin.mutation(api.pages.mutations.updateResource, {
				id: required(ids[0]),
				title: "overwrite",
				excerpt: "old client",
				content: "bad",
				tag: "old",
				icon: "book",
				published: true,
			}),
		).rejects.toThrow("håndbokens redigering");
	});
	it("retires without deleting history or bookmarks and validates replacements", async () => {
		const { admin, resourceId } = await setupArticle();
		await admin.mutation(api.wiki.mutations.bookmark, { resourceId, saved: true });
		await expect(
			admin.mutation(api.wiki.mutations.retire, {
				resourceId,
				expectedVersion: 1,
				note: "Ny rutine",
				replacementSlug: article.slug,
			}),
		).rejects.toThrow("Velg en annen");
		await admin.mutation(api.wiki.mutations.save, {
			article: { ...article, slug: "new-process" },
			expectedVersion: 0,
			publish: true,
		});
		await admin.mutation(api.wiki.mutations.retire, {
			resourceId,
			expectedVersion: 1,
			note: "Erstattet av ny rutine",
			replacementSlug: "new-process",
		});
		expect(
			(await admin.query(api.wiki.queries.browse, { query: "", paginationOpts })).page.map(
				(row) => row.slug,
			),
		).toEqual(["new-process"]);
		const retired = await admin.query(api.wiki.queries.get, { slug: article.slug });
		expect(retired).toMatchObject({
			bookmarked: true,
			replacementSlug: "new-process",
			wikiStatus: "retired",
		});
		expect(
			(await admin.query(api.wiki.queries.history, { resourceId, paginationOpts })).page,
		).toHaveLength(2);
	});
	it("validates seed articles, related links and linked feature sources", () => {
		const slugs = new Set(HANDBOOK_ARTICLES.map((row) => row.slug));
		expect(slugs.size).toBe(HANDBOOK_ARTICLES.length);
		for (const entry of HANDBOOK_ARTICLES) {
			expect(wikiArticleSchema.safeParse(entry).success, entry.slug).toBe(true);
			for (const slug of entry.relatedSlugs)
				expect(slugs.has(slug), `${entry.slug} -> ${slug}`).toBe(true);
			for (const link of entry.content.matchAll(/href="\/wiki\/([^"]+)"/g))
				expect(slugs.has(required(link[1])), entry.slug).toBe(true);
		}
		expect(sourceInfo("tilbakemeldinger").paths).toContain("packages/shared/time/feedback.ts");
	});
	it("reads changing product data live and handles missing form data", async () => {
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
