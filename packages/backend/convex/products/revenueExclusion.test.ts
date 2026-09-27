import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertUser, refusalMessageFrom, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

async function fixture() {
	const { t, companyId } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const editor = await insertUser(t, "editor@example.test");
	await grantRole(t, editor._id, "editor");
	return { t, companyId, admin: asUser(t, admin), editor: asUser(t, editor) };
}

describe("setRevenueExclusion", () => {
	it("refuses callers below admin", async () => {
		const { companyId, editor } = await fixture();
		await expect(
			refusalMessageFrom(
				editor.mutation(api.products.revenueExclusion.setRevenueExclusion, {
					companyIds: [companyId],
					excluded: true,
				}),
			),
		).resolves.toContain("Unauthorized");
	});

	it("refuses an empty selection", async () => {
		const { admin } = await fixture();
		await expect(
			refusalMessageFrom(
				admin.mutation(api.products.revenueExclusion.setRevenueExclusion, {
					companyIds: [],
					excluded: true,
				}),
			),
		).resolves.toBe("Velg mellom 1 og 200 bedrifter.");
	});

	it("refuses a missing company", async () => {
		const { t, companyId, admin } = await fixture();
		await t.run((ctx) => ctx.db.delete(companyId));
		await expect(
			refusalMessageFrom(
				admin.mutation(api.products.revenueExclusion.setRevenueExclusion, {
					companyIds: [companyId],
					excluded: true,
				}),
			),
		).resolves.toBe("Bedriften ble ikke funnet.");
	});

	it("excludes and includes companies again", async () => {
		const { t, companyId, admin } = await fixture();
		const setExclusion = (excluded: boolean) =>
			admin.mutation(api.products.revenueExclusion.setRevenueExclusion, {
				companyIds: [companyId],
				excluded,
			});

		await expect(setExclusion(true)).resolves.toBe(1);
		expect((await t.run((ctx) => ctx.db.get(companyId)))?.excludedFromRevenue).toBe(true);

		await setExclusion(false);
		expect((await t.run((ctx) => ctx.db.get(companyId)))?.excludedFromRevenue).toBe(false);
	});
});
