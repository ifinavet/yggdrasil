import { describe, expect, it } from "vitest";
import { setup } from "../../test/fixtures";
import { api } from "../_generated/api";

async function setupWithOrphanedLogo() {
	const { t, companyId } = await setup();
	const orphanId = await t.run(async (ctx) => {
		const image = await ctx.storage.store(new Blob(["gone"]));
		const logo = await ctx.db.insert("companyLogos", { name: "gone", image });
		const id = await ctx.db.insert("companies", {
			orgNumber: 987654321,
			name: "Uten logo",
			description: "",
			mainSponsor: false,
			logo,
		});
		await ctx.db.delete(logo);
		return id;
	});
	return { t, companyId, orphanId };
}

describe("company list queries", () => {
	it("returns each paged company with its logo URL", async () => {
		const { t, companyId } = await setup();

		const result = await t.query(api.companies.queries.getAllPaged, {
			paginationOpts: { numItems: 25, cursor: null },
		});

		expect(result.isDone).toBe(true);
		expect(result.page).toHaveLength(1);
		expect(result.page[0]?._id).toBe(companyId);
		expect(result.page[0]?.logoUrl).toMatch(/^http/);
	});

	it("keeps a paged company whose logo is missing, with a null URL", async () => {
		const { t, companyId, orphanId } = await setupWithOrphanedLogo();

		const { page } = await t.query(api.companies.queries.getAllPaged, {
			paginationOpts: { numItems: 25, cursor: null },
		});
		const urls = new Map(page.map((company) => [company._id, company.logoUrl]));

		expect(urls.get(companyId)).toMatch(/^http/);
		expect(urls.get(orphanId)).toBeNull();
	});

	it("returns every company with its logo URL for searching", async () => {
		const { t, companyId, orphanId } = await setupWithOrphanedLogo();

		const companies = await t.query(api.companies.queries.getAllWithLogoUrl, {});
		const urls = new Map(companies.map((company) => [company._id, company.logoUrl]));

		expect(companies).toHaveLength(2);
		expect(urls.get(companyId)).toMatch(/^http/);
		expect(urls.get(orphanId)).toBeNull();
	});
});
