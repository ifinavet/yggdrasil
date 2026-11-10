import { expect, it } from "vitest";
import { insertEventProduct, setup } from "../../test/fixtures";
import { productOf } from "./helpers";

it("finds the referenced product first, then the first active product of the type", async () => {
	const { t } = await setup();
	const archivedId = await insertEventProduct(t, "standard_presentation", "Utgått ordinær");
	await t.run((ctx) => ctx.db.patch(archivedId, { active: false }));
	await insertEventProduct(t, "workshop");
	const find = (row: Parameters<typeof productOf>[1]) =>
		t.run(async (ctx) => (await productOf(ctx, row))?._id ?? null);

	expect(await find({ eventType: "standard_presentation" })).toBeNull();
	expect(await find({ eventType: "large_presentation" })).toBeNull();

	const firstId = await insertEventProduct(t, "standard_presentation");
	await insertEventProduct(t, "standard_presentation", "Ordinær nummer to");
	expect(await find({ eventType: "standard_presentation" })).toBe(firstId);
	expect(await find({ eventType: "standard_presentation", productId: archivedId })).toBe(
		archivedId,
	);
});
