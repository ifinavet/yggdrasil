import { JOB_LISTING_ORDER_DEFAULTS } from "@workspace/shared/job-listing-orders";
import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

async function clientWithRole(role: "admin" | "editor") {
	const { t } = await setup();
	const user = await insertUser(t, `${role}@example.test`);
	await grantRole(t, user._id, role);
	return asUser(t, user);
}

describe("job listing order settings", () => {
	it("lets an admin save the settings", async () => {
		const admin = await clientWithRole("admin");
		const settings = { ...JOB_LISTING_ORDER_DEFAULTS, open: !JOB_LISTING_ORDER_DEFAULTS.open };

		await admin.mutation(api.jobListingOrders.settings.save, { settings });

		expect(await admin.query(api.jobListingOrders.settings.current, {})).toEqual(settings);
	});

	it("refuses callers below admin", async () => {
		const editor = await clientWithRole("editor");

		await expect(
			editor.mutation(api.jobListingOrders.settings.save, {
				settings: JOB_LISTING_ORDER_DEFAULTS,
			}),
		).rejects.toThrow("Unauthorized");
	});
});
