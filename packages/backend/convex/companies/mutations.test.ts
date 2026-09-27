import { LOGO_MAX_BYTES, LOGO_MESSAGES } from "@workspace/shared/logo";
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
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	return { t, admin: asUser(t, admin) };
}

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
