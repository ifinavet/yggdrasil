import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { MAX_PRODUCTS } from "./helpers";
import { SEED_PRODUCTS } from "./seed";

const newProduct = {
	name: "Kurs",
	shortDescription: "Et kurs",
	longDescription: "Et lengre kurs",
	category: "event" as const,
	unitPriceOre: 1_000_000,
	vatRate: 25,
	maxStudents: 30,
};

async function fixture() {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const editor = await insertUser(t, "editor@example.test");
	await grantRole(t, editor._id, "editor");
	return { t, admin: asUser(t, admin), editor: asUser(t, editor) };
}

function expectDefined<T>(value: T | null): T {
	expect(value).not.toBeNull();
	return value as T;
}

async function changesFor(t: TestBackend, productId: Id<"products">) {
	return t.run((ctx) =>
		ctx.db
			.query("productChanges")
			.withIndex("by_productId", (q) => q.eq("productId", productId))
			.collect(),
	);
}

describe("products", () => {
	it("refuses callers below admin", async () => {
		const { t, editor } = await fixture();
		const productId = await t.run((ctx) =>
			ctx.db.insert("products", { ...newProduct, sortOrder: 0, active: true }),
		);

		const refusals = await Promise.all([
			refusalMessageFrom(editor.mutation(api.products.mutations.create, newProduct)),
			refusalMessageFrom(
				editor.mutation(api.products.mutations.update, { id: productId, ...newProduct }),
			),
			refusalMessageFrom(
				editor.mutation(api.products.mutations.setActive, { id: productId, active: false }),
			),
			refusalMessageFrom(editor.mutation(api.products.mutations.reorder, { ids: [productId] })),
			refusalMessageFrom(editor.query(api.products.queries.listAll, {})),
			refusalMessageFrom(editor.query(api.products.queries.getWithChanges, { id: productId })),
		]);

		for (const message of refusals) expect(message).toContain("Unauthorized");
	});

	it("creates products at the end of the list and logs who created them", async () => {
		const { admin } = await fixture();
		const first = await admin.mutation(api.products.mutations.create, newProduct);
		const second = await admin.mutation(api.products.mutations.create, {
			...newProduct,
			name: "Annet kurs",
		});

		const products = await admin.query(api.products.queries.listAll, {});
		expect(products.map((product) => [product._id, product.sortOrder])).toEqual([
			[first, 0],
			[second, 1],
		]);

		const { changes } = expectDefined(
			await admin.query(api.products.queries.getWithChanges, { id: first }),
		);
		expect(changes).toMatchObject([{ action: "created", changedByName: "Test Testesen" }]);
		expect(changes[0]?.changes).toContainEqual({ field: "unitPriceOre", after: "1000000" });
	});

	it("rejects invalid input and duplicate names", async () => {
		const { admin } = await fixture();
		const productId = await admin.mutation(api.products.mutations.create, newProduct);
		await admin.mutation(api.products.mutations.create, { ...newProduct, name: "Opptatt" });

		expect(
			await refusalMessageFrom(
				admin.mutation(api.products.mutations.create, { ...newProduct, unitPriceOre: -5 }),
			),
		).toBe("Prisen må være et beløp mellom 0 og 1 000 000 kr.");
		expect(
			await refusalMessageFrom(
				admin.mutation(api.products.mutations.update, {
					id: productId,
					...newProduct,
					name: "Opptatt",
				}),
			),
		).toBe("Det finnes allerede et produkt med dette navnet.");
	});

	it("updates fields, clears removed optionals and logs only the diff", async () => {
		const { t, admin } = await fixture();
		const productId = await admin.mutation(api.products.mutations.create, newProduct);
		const { maxStudents: _, ...withoutCap } = newProduct;

		await admin.mutation(api.products.mutations.update, {
			id: productId,
			...withoutCap,
			unitPriceOre: 1_200_000,
		});
		await admin.mutation(api.products.mutations.update, {
			id: productId,
			...withoutCap,
			unitPriceOre: 1_200_000,
		});

		const product = await t.run((ctx) => ctx.db.get(productId));
		expect(product).toMatchObject({ unitPriceOre: 1_200_000, name: "Kurs" });
		expect(product?.maxStudents).toBeUndefined();

		const updates = (await changesFor(t, productId)).filter(
			(change) => change.action === "updated",
		);
		expect(updates).toHaveLength(1);
		expect(updates[0]?.changes).toEqual([
			{ field: "unitPriceOre", before: "1000000", after: "1200000" },
			{ field: "maxStudents", before: "30", after: undefined },
		]);
	});

	it("archives and restores without deleting, and hides archived products publicly", async () => {
		const { t, admin } = await fixture();
		const productId = await admin.mutation(api.products.mutations.create, newProduct);

		await admin.mutation(api.products.mutations.setActive, { id: productId, active: false });
		await admin.mutation(api.products.mutations.setActive, { id: productId, active: false });
		expect(await t.query(api.products.queries.listActive, {})).toEqual([]);

		await admin.mutation(api.products.mutations.setActive, { id: productId, active: true });
		expect(await t.query(api.products.queries.listActive, {})).toHaveLength(1);

		const actions = (await changesFor(t, productId)).map((change) => change.action);
		expect(actions).toEqual(["created", "archived", "restored"]);
	});

	it("reorders all products and refuses partial orders", async () => {
		const { t, admin } = await fixture();
		const first = await admin.mutation(api.products.mutations.create, newProduct);
		const second = await admin.mutation(api.products.mutations.create, {
			...newProduct,
			name: "Annet kurs",
		});

		expect(
			await refusalMessageFrom(admin.mutation(api.products.mutations.reorder, { ids: [first] })),
		).toBe("Rekkefølgen må inneholde alle produktene nøyaktig én gang.");
		expect(
			await refusalMessageFrom(
				admin.mutation(api.products.mutations.reorder, { ids: [first, first] }),
			),
		).toBe("Rekkefølgen må inneholde alle produktene nøyaktig én gang.");

		const third = await admin.mutation(api.products.mutations.create, {
			...newProduct,
			name: "Tredje kurs",
		});

		await admin.mutation(api.products.mutations.reorder, { ids: [second, first, third] });
		const products = await admin.query(api.products.queries.listAll, {});
		expect(products.map((product) => product._id)).toEqual([second, first, third]);
		expect((await changesFor(t, first)).map((change) => change.action)).toContain("reordered");
		expect((await changesFor(t, third)).map((change) => change.action)).toEqual(["created"]);
	});

	it("reports a missing product", async () => {
		const { t, admin } = await fixture();
		const productId = await t.run(async (ctx) => {
			const id = await ctx.db.insert("products", { ...newProduct, sortOrder: 0, active: true });
			await ctx.db.delete(id);
			return id;
		});

		expect(await admin.query(api.products.queries.getWithChanges, { id: productId })).toBeNull();
		expect(
			await refusalMessageFrom(
				admin.mutation(api.products.mutations.setActive, { id: productId, active: false }),
			),
		).toBe("Fant ikke produktet.");
	});

	it("refuses to create more than the product limit", async () => {
		const { t, admin } = await fixture();
		await t.run(async (ctx) => {
			for (let index = 0; index < MAX_PRODUCTS; index++) {
				await ctx.db.insert("products", {
					...newProduct,
					name: `Produkt ${index}`,
					sortOrder: index,
					active: true,
				});
			}
		});

		expect(
			await refusalMessageFrom(admin.mutation(api.products.mutations.create, newProduct)),
		).toBe("Maksimalt antall produkter er nådd.");
	});

	it("seeds the offer page products once", async () => {
		const { t, admin } = await fixture();

		const inserted = await t.mutation(internal.products.seed.seedProducts, {});
		const again = await t.mutation(internal.products.seed.seedProducts, {});

		expect(inserted).toEqual(SEED_PRODUCTS.map((product) => product.name));
		expect(again).toEqual([]);
		const products = await t.query(api.products.queries.listActive, {});
		expect(products.map((product) => [product.name, product.unitPriceOre])).toEqual([
			["Stor bedriftspresentasjon", 4_000_000],
			["Ordinær bedriftspresentasjon", 3_000_000],
			["Bedriftspresentasjon med fokus på faglig innhold", 2_000_000],
			["Sosialt arrangement", undefined],
			["Eksterne arrangementer", 1_500_000],
			["Stillingsannonse", undefined],
		]);

		const seeded = products[0] as (typeof products)[number];
		const { changes } = expectDefined(
			await admin.query(api.products.queries.getWithChanges, { id: seeded._id }),
		);
		expect(changes).toMatchObject([{ action: "created", changedByName: null }]);
	});
});
