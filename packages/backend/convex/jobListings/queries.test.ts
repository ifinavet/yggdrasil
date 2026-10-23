import { describe, expect, it } from "vitest";
import { refusalMessageFrom, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

describe("jobListings.queries.getById", () => {
	it("refuses an id that is not a job listing id", async () => {
		const { t, companyId } = await setup();

		const malformed = await refusalMessageFrom(
			t.query(api.jobListings.queries.getById, { id: "x" }),
		);
		const otherTable = await refusalMessageFrom(
			t.query(api.jobListings.queries.getById, { id: companyId }),
		);

		expect(malformed).toContain("ikke funnet");
		expect(otherTable).toContain("ikke funnet");
	});
});
