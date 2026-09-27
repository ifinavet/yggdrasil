import { describe, expect, it } from "vitest";
import { draftSnapshot, parseDraft } from "./draft";
import { emptyOrderForm } from "./form-values";

describe("order draft", () => {
	it("round-trips the form without the confirmation or honeypot", () => {
		const values = { ...emptyOrderForm(), note: "Hei", confirmAmount: true, website: "spam" };
		expect(parseDraft(JSON.parse(JSON.stringify(draftSnapshot(values))))).toEqual({
			...values,
			confirmAmount: false,
			website: "",
		});
	});

	it("never stores the confirmation or honeypot", () => {
		const snapshot = draftSnapshot({ ...emptyOrderForm(), confirmAmount: true, website: "spam" });
		expect(snapshot).toMatchObject({ confirmAmount: false, website: "" });
	});

	it("rejects missing and outdated drafts", () => {
		expect(parseDraft(null)).toBeNull();
		expect(parseDraft({ note: "Hei" })).toBeNull();
		expect(parseDraft({ ...emptyOrderForm(), listings: [] })).toBeNull();
	});
});
