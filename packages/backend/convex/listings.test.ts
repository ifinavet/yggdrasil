import { faker } from "@faker-js/faker";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

test("creating a job listing", async () => {
	const t = convexTest(schema, modules);
	const asSarah = t.withIdentity({ name: "Sarah" });

	const companyLogoId = await t.run(async (ctx) => {
		const storageId = await ctx.storage.store(
			new Blob(["dummy image bytes"], { type: "image/png" }),
		);

		const logoId = await ctx.db.insert("companyLogos", {
			name: "Test Logo",
			image: storageId,
		});

		return logoId;
	});

	const company = await asSarah.mutation(api.companies.create, {
		description: faker.company.catchPhrase(),
		logo: companyLogoId,
		name: faker.company.name(),
		orgNumber: 1234567890,
	});

	await asSarah.mutation(api.listings.create, {
		description: "Test job description",
		type: "Sommerjobb",
		title: "Software Engineer",
		published: true,
		teaser: "Join our team!",
		applicationUrl: "https://test.test",
		company: company,
		deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week from now
		contacts: [
			{
				name: "Jane Doe",
				email: "jane@example.com",
				phone: "12345678",
			},
		],
	});

	const listing = await t.query(api.listings.getAll, {});

	expect(listing).length(1);
	expect(listing[0].title).toBe("Software Engineer");
});
