import { LOGO_MAX_BYTES, LOGO_MESSAGES } from "@workspace/shared/logo";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api } from "../_generated/api";

async function fixture() {
	const { t, companyId } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	return { t, companyId, admin: asUser(t, admin) };
}

describe("updateMainSponsor", () => {
	it("announces only each new sponsor assignment", async () => {
		const { t, companyId, admin } = await fixture();
		const company = await t.run((ctx) => ctx.db.get(companyId));
		if (!company) throw new Error("Company was not created");
		const nextCompanyId = await t.run((ctx) =>
			ctx.db.insert("companies", {
				orgNumber: 987654321,
				name: "Ny sponsor",
				description: "",
				mainSponsor: false,
				logo: company.logo,
			}),
		);

		await admin.mutation(api.companies.mutations.updateMainSponsor, { companyId });
		await admin.mutation(api.companies.mutations.updateMainSponsor, { companyId });
		await admin.mutation(api.companies.mutations.updateMainSponsor, { companyId: nextCompanyId });
		await admin.mutation(api.companies.mutations.updateMainSponsor, { companyId: nextCompanyId });

		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		const alerts = scheduled.filter(({ name }) => name.includes("notifications:sendMessage"));
		expect(alerts).toHaveLength(2);
		expect(alerts[0]?.args[0]).toMatchObject({
			channel: SYSTEM_ALERTS_CHANNEL,
			text: expect.stringContaining("🎉🥳💸💰 *Ny hovedsponsor!*"),
		});
		expect(alerts[1]?.args[0].text).toContain("Ny sponsor");
	});
});

async function storeFile(t: TestBackend, contentType: string, bytes = 4) {
	return t.run(async (ctx) => {
		const storageId = await ctx.storage.store(new Blob([new Uint8Array(bytes)]));
		// biome-ignore lint/suspicious/noExplicitAny: convex-test drops the upload content type, which Convex records on real uploads.
		await (ctx.db as any).patch(storageId, { contentType });
		return storageId;
	});
}

describe("uploadCompanyLogo", () => {
	it("stores a logo within the shared rules", async () => {
		const { t, admin } = await fixture();
		const id = await storeFile(t, "image/webp");
		const logoId = await admin.mutation(api.companies.mutations.uploadCompanyLogo, {
			id,
			name: "Acme",
		});
		const logo = await t.run((ctx) => ctx.db.get(logoId));
		expect(logo).toMatchObject({ name: "Acme", image: id });
	});

	it("refuses a file type the shared rules do not allow", async () => {
		const { t, admin } = await fixture();
		const id = await storeFile(t, "image/gif");
		const message = await refusalMessageFrom(
			admin.mutation(api.companies.mutations.uploadCompanyLogo, { id, name: "Acme" }),
		);
		expect(message).toBe(LOGO_MESSAGES.wrongType);
	});

	it("refuses a logo above the stored size limit", async () => {
		const { t, admin } = await fixture();
		const id = await storeFile(t, "image/png", LOGO_MAX_BYTES + 1);
		const message = await refusalMessageFrom(
			admin.mutation(api.companies.mutations.uploadCompanyLogo, { id, name: "Acme" }),
		);
		expect(message).toBe(LOGO_MESSAGES.tooLarge);
	});
});
