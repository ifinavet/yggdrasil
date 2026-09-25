import { describe, expect, it } from "vitest";
import { parseDraft, serializeDraft } from "./draft";
import { emptyOrderForm } from "./form-values";

describe("order draft", () => {
	it("round-trips the form without the confirmation or honeypot", () => {
		const values = { ...emptyOrderForm(), note: "Hei", confirmAmount: true, website: "spam" };
		expect(parseDraft(serializeDraft(values))).toEqual({
			...values,
			confirmAmount: false,
			website: "",
		});
	});

	it("never stores the confirmation or honeypot", () => {
		const raw = serializeDraft({ ...emptyOrderForm(), confirmAmount: true, website: "spam" });
		expect(JSON.parse(raw)).toMatchObject({ confirmAmount: false, website: "" });
	});

	it("rejects missing, malformed and outdated drafts", () => {
		expect(parseDraft(null)).toBeNull();
		expect(parseDraft("{not json")).toBeNull();
		expect(parseDraft(JSON.stringify({ note: "Hei" }))).toBeNull();
		expect(parseDraft(JSON.stringify({ ...emptyOrderForm(), listings: [] }))).toBeNull();
	});
});
