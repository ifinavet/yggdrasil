import { describe, expect, it } from "vitest";
import { groupPending, type InvoiceSummary } from "./invoice-labels";

function invoice(companyName: string, serviceAt: number, issue?: string) {
	return { companyName, serviceAt, status: "pending", issue } as InvoiceSummary;
}

describe("groupPending", () => {
	it("keeps delivered items in the work queue and future events separate", () => {
		const groups = groupPending(
			[
				invoice("earlier", 10),
				invoice("today", 20),
				invoice("future", 21),
				invoice("blocked", 10, "Mangler pris"),
			],
			20,
		);
		expect(groups.ready.map((entry) => entry.companyName)).toEqual(["earlier", "today"]);
		expect(groups.upcoming.map((entry) => entry.companyName)).toEqual(["future"]);
		expect(groups.blocked.map((entry) => entry.companyName)).toEqual(["blocked"]);
	});
});
