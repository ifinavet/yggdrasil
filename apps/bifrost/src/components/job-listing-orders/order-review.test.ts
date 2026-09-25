import { describe, expect, it } from "vitest";
import {
	APPROVE_BLOCKED_MESSAGE,
	approveBlocker,
	companyChangeRows,
	formatBilling,
	formatDeadline,
} from "./order-review";

describe("approveBlocker", () => {
	it("blocks approval while the company update is pending", () => {
		expect(approveBlocker({ status: "pending" })).toBe(APPROVE_BLOCKED_MESSAGE);
	});

	it("allows approval without an update or after it is decided", () => {
		expect(approveBlocker(null)).toBeUndefined();
		expect(approveBlocker({ status: "approved" })).toBeUndefined();
		expect(approveBlocker({ status: "rejected" })).toBeUndefined();
	});
});

describe("companyChangeRows", () => {
	it("lists only changed fields in a fixed order with the previous value", () => {
		const rows = companyChangeRows({
			status: "pending",
			changes: {
				billing: { address: "Gate 1", email: "a@b.no", reference: "R1" },
				displayName: "Nytt navn",
			},
			previous: { displayName: "Gammelt navn" },
		});
		expect(rows).toEqual([
			{ key: "displayName", label: "Visningsnavn", before: "Gammelt navn", after: "Nytt navn" },
			{
				key: "billing",
				label: "Fakturainformasjon",
				before: undefined,
				after: { address: "Gate 1", email: "a@b.no", reference: "R1" },
			},
		]);
	});

	it("keeps a removed logo as a change", () => {
		const rows = companyChangeRows({
			status: "pending",
			changes: { logoUrl: null },
			previous: { logoUrl: "https://example.com/logo.png" },
		});
		expect(rows.map((row) => row.key)).toEqual(["logoUrl"]);
	});

	it("returns no rows when nothing changed", () => {
		expect(companyChangeRows({ status: "pending", changes: {}, previous: {} })).toEqual([]);
	});
});

describe("formatBilling", () => {
	it("joins the filled billing fields", () => {
		expect(formatBilling({ address: "Gate 1, 0150 Oslo", email: "f@b.no", reference: "" })).toBe(
			"Gate 1, 0150 Oslo, f@b.no",
		);
	});

	it("is empty without billing", () => {
		expect(formatBilling(undefined)).toBe("");
	});
});

describe("formatDeadline", () => {
	it("formats the date in Oslo time", () => {
		expect(formatDeadline("2026-10-01")).toBe("1. oktober 2026");
	});

	it("keeps the date across the daylight saving change", () => {
		expect(formatDeadline("2026-10-25")).toBe("25. oktober 2026");
	});
});
