import { describe, expect, it } from "vitest";
import { groupInvoices, type InvoiceSummary } from "./invoice-labels";

function invoice(companyName: string, status: InvoiceSummary["status"], dueAt = 0) {
	return {
		_id: companyName,
		kind: "jobListingOrder",
		companyName,
		serviceAt: 0,
		dueAt,
		status,
	} as unknown as InvoiceSummary;
}

describe("groupInvoices", () => {
	it("splits invoices into failed, upcoming by due date, and previous", () => {
		const groups = groupInvoices([
			invoice("later", "scheduled", 30),
			invoice("draft", "draft_created"),
			invoice("broken", "failed"),
			invoice("sending", "queued", 10),
			invoice("cancelled", "cancelled"),
			invoice("sooner", "scheduled", 20),
		]);
		const names = (list: InvoiceSummary[]) => list.map((entry) => entry.companyName);

		expect({
			failed: names(groups.failed),
			upcoming: names(groups.upcoming),
			previous: names(groups.previous),
		}).toEqual({
			failed: ["broken"],
			upcoming: ["sending", "sooner", "later"],
			previous: ["draft", "cancelled"],
		});
	});
});
