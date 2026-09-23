import {
	emptyFeedbackAnswers,
	type FeedbackField,
	feedbackAnswersSchema,
	feedbackErrors,
	feedbackPrefill,
	validateFeedbackFields,
} from "@workspace/shared/feedback";
import { feedbackOpensAt, feedbackRetentionAt } from "@workspace/shared/feedback/time";
import { describe, expect, it } from "vitest";
import { hashFeedbackToken } from "./tokens";

const field: FeedbackField = {
	key: "score",
	type: "rating",
	label: "Hvor fornøyd?",
	required: true,
};
describe("feedback contracts", () => {
	it.each([1, 2, 3, 4, 5])("accepts rating %s", (score) =>
		expect(feedbackErrors([field], { score })).toEqual({}),
	);
	it.each([0, 6, 1.5, NaN, Infinity, "1", ["1"]])("rejects invalid rating %s", (score) =>
		expect(feedbackErrors([field], { score })).toHaveProperty("score"),
	);
	it.each([undefined, "", []])("requires an answer %s", (score) =>
		expect(feedbackErrors([field], score === undefined ? {} : { score })).toHaveProperty("score"),
	);
	it("permits omitted optional fields and rejects unknown keys", () => {
		expect(feedbackErrors([{ ...field, required: false }], {})).toEqual({});
		expect(feedbackErrors([field], { score: 5, unknown: 1 })).toHaveProperty("_form");
	});
	it("treats inherited answers as omitted", () => {
		const optional = [{ ...field, required: false }];
		const inheritedInvalid = Object.create({ score: "invalid" });
		expect(feedbackAnswersSchema(optional).safeParse(inheritedInvalid).success).toBe(true);
		expect(feedbackErrors(optional, inheritedInvalid)).toEqual({});
		expect(feedbackErrors([field], Object.create({ score: 5 }))).toEqual({
			score: "Fyll inn et svar",
		});
	});
	it("validates own answers and unknown keys even when the payload has a prototype", () => {
		const data = Object.assign(Object.create({ score: "invalid", inherited: true }), { score: 5 });
		expect(feedbackErrors([field], data)).toEqual({});
		data.score = 6;
		expect(feedbackErrors([field], data)).toHaveProperty("score");
		data.score = 5;
		data.unknown = true;
		expect(feedbackErrors([field], data)).toHaveProperty("_form");
	});
	it("validates text, yes/no and options", () => {
		const fields: [FeedbackField, FeedbackField, FeedbackField] = [
			{ ...field, key: "text", type: "text" },
			{ ...field, key: "bool", type: "yesNo" },
			{ ...field, key: "choice", type: "options", options: ["A", "B"] },
		];
		expect(feedbackErrors(fields, { text: "Bra", bool: "ja", choice: ["A", "B"] })).toEqual({});
		expect(feedbackErrors(fields, { text: " ", bool: "yes", choice: ["C"] })).toHaveProperty(
			"choice",
		);
		expect(
			feedbackErrors(fields, { text: "x".repeat(1001), bool: "nei", choice: ["A", "A"] }),
		).toHaveProperty("text");
		expect(
			feedbackErrors([{ ...fields[2], allowOther: true }], { choice: ["A", "Annet"] }),
		).toEqual({});
		expect(
			feedbackErrors([{ ...fields[2], allowOther: true }], { choice: ["Annet", "To"] }),
		).toHaveProperty("choice");
	});
	it("validates published definitions", () => {
		expect(validateFeedbackFields([field])).toBeNull();
		for (const fields of [
			[],
			Array(41).fill(field),
			[field, field],
			[{ ...field, key: "constructor" }],
			[{ ...field, key: "Invalid" }],
			[{ ...field, label: " " }],
			[{ ...field, low: "x".repeat(501) }],
			[{ ...field, type: "options" as const }],
			[{ ...field, type: "options" as const, options: ["A", "A"] }],
		])
			expect(validateFeedbackFields(fields)).toBeTruthy();
	});
	it.each([null, {}, [null], [{ ...field, type: "unknown" }], [{ ...field, required: "yes" }]])(
		"rejects malformed definitions without throwing: %j",
		(fields) => expect(validateFeedbackFields(fields)).toBeTruthy(),
	);
	it.each([null, [], "answer", { score: null }, { score: true }, { score: {} }])(
		"rejects malformed answer payloads without throwing: %j",
		(data) => expect(Object.keys(feedbackErrors([field], data)).length).toBeGreaterThan(0),
	);
	it("normalizes empty optional answers and reports required answers consistently", () => {
		for (const value of [undefined, "", []]) {
			expect(feedbackErrors([{ ...field, required: false }], { score: value })).toEqual({});
			expect(feedbackErrors([field], { score: value })).toEqual({ score: "Fyll inn et svar" });
		}
	});
	it("rejects malformed, duplicate and excessive other selections", () => {
		const choice: FeedbackField = { ...field, type: "options", options: ["A", "B"] };
		for (const value of [[1], [null], [" "], ["A", "A"], ["C"], "A"]) {
			expect(feedbackErrors([choice], { score: value })).toHaveProperty("score");
		}
		expect(feedbackErrors([choice], { score: ["A", "B"] })).toEqual({});
		expect(feedbackErrors([{ ...choice, allowOther: true }], { score: ["A", "C"] })).toEqual({});
		expect(feedbackErrors([{ ...choice, allowOther: true }], { score: ["C", "D"] })).toHaveProperty(
			"score",
		);
	});
	it("only prefills a valid rating", () => {
		expect(feedbackPrefill([field], "score", "5")).toEqual({ score: 5 });
		for (const answer of [undefined, "0", "6", "05", "1.5", "abc"])
			expect(feedbackPrefill([field], "score", answer)).toEqual({ score: "" });
		expect(feedbackPrefill([field], "other", "5")).toEqual({ score: "" });
		expect(emptyFeedbackAnswers([{ ...field, type: "options" }])).toEqual({ score: [] });
	});
});
describe("Oslo campaign calendar", () => {
	it.each([
		["2026-01-10T20:00:00Z", "2026-01-11T07:00:00Z"],
		["2026-07-10T20:00:00Z", "2026-07-11T06:00:00Z"],
		["2026-03-28T20:00:00Z", "2026-03-29T06:00:00Z"],
		["2026-10-24T20:00:00Z", "2026-10-25T07:00:00Z"],
		["2026-12-31T23:30:00Z", "2027-01-02T07:00:00Z"],
		["2028-02-28T23:30:00Z", "2028-03-01T07:00:00Z"],
	])("opens after %s at %s", (start, expected) =>
		expect(feedbackOpensAt(Date.parse(start))).toBe(Date.parse(expected)),
	);
	it("clamps eighteen calendar months to the last day", () => {
		expect(feedbackRetentionAt(Date.parse("2024-08-31T08:00:00Z"))).toBe(
			Date.parse("2026-02-28T08:00:00Z"),
		);
		expect(feedbackRetentionAt(Date.parse("2026-01-10T08:00:00Z"))).toBe(
			Date.parse("2027-07-10T08:00:00Z"),
		);
		expect(feedbackRetentionAt(Date.parse("2026-08-31T23:59:59.123Z"))).toBe(
			Date.parse("2028-02-29T23:59:59.123Z"),
		);
	});
	it("hashes the token using SHA256", async () =>
		expect(await hashFeedbackToken("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		));
});
