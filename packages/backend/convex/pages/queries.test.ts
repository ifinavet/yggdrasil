import { describe, expect, it } from "vitest";
import { setup } from "../../test/fixtures";
import { api } from "../_generated/api";

describe("getAllGroupedByTag", () => {
	it("groups published resources by tag in the order the tags first appear", async () => {
		const { t } = await setup();
		await t.run(async (ctx) => {
			for (const [title, tag, published] of [
				["Budsjett", "Økonomi", true],
				["Romlån", "Arrangement", true],
				["Regnskap", "Økonomi", true],
				["Uten tag", undefined, true],
				["Utkast", "Økonomi", false],
			] as const) {
				await ctx.db.insert("resources", {
					title,
					content: "",
					excerpt: "",
					tag,
					published,
					updatedAt: 0,
				});
			}
		});

		const { groupedByTag, unpublishedResources } = await t.query(
			api.pages.queries.getAllGroupedByTag,
		);

		expect(
			groupedByTag.map(({ tag, resources }) => ({
				tag,
				titles: resources.map((resource) => resource.title),
			})),
		).toEqual([
			{ tag: "Økonomi", titles: ["Budsjett", "Regnskap"] },
			{ tag: "Arrangement", titles: ["Romlån"] },
			{ tag: "uncategorized", titles: ["Uten tag"] },
		]);
		expect(unpublishedResources).toEqual([]);
	});
});
