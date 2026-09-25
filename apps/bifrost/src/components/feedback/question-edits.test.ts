import type { FeedbackField } from "@workspace/shared/feedback";
import { describe, expect, it } from "vitest";
import {
	addOption,
	changeQuestionType,
	createQuestion,
	duplicateQuestion,
	maxOptions,
	maxQuestions,
	minOptions,
	moveQuestion,
	removeOption,
} from "./question-edits";

function question(key: string, change: Partial<FeedbackField> = {}): FeedbackField {
	return { key, type: "text", label: key, required: true, placeholder: "", ...change };
}

const keys = (fields: FeedbackField[]) => fields.map((field) => field.key);

describe("createQuestion", () => {
	it("creates a required text question with a unique key", () => {
		const first = createQuestion();
		const second = createQuestion();
		expect(first).toMatchObject({ type: "text", label: "", required: true });
		expect(first.key).toMatch(/^question_[0-9a-f]{32}$/);
		expect(first.key).not.toBe(second.key);
	});
});

describe("duplicateQuestion", () => {
	it("inserts a copy with a new key after the original", () => {
		const fields = [question("a", { type: "options", options: ["x", "y"] }), question("b")];
		const result = duplicateQuestion(fields, 0);
		expect(result).toHaveLength(3);
		expect(result[1]).toMatchObject({ label: "a", options: ["x", "y"] });
		expect(result[1]?.key).not.toBe("a");
		expect(result[1]?.options).not.toBe(fields[0]?.options);
		expect(result[2]?.key).toBe("b");
	});

	it("leaves the fields unchanged at the question limit", () => {
		const fields = Array.from({ length: maxQuestions }, (_, index) => question(`q${index}`));
		expect(duplicateQuestion(fields, 0)).toBe(fields);
	});

	it("leaves the fields unchanged for an unknown index", () => {
		const fields = [question("a")];
		expect(duplicateQuestion(fields, 5)).toBe(fields);
	});
});

describe("moveQuestion", () => {
	const fields = [question("a"), question("b"), question("c")];

	it("moves a question down", () => {
		expect(keys(moveQuestion(fields, 0, 2))).toEqual(["b", "c", "a"]);
	});

	it("moves a question up", () => {
		expect(keys(moveQuestion(fields, 2, 0))).toEqual(["c", "a", "b"]);
	});

	it.each([
		[0, 0],
		[0, -1],
		[2, 3],
		[5, 0],
	])("ignores a move from %i to %i", (from, to) => {
		expect(moveQuestion(fields, from, to)).toBe(fields);
	});
});

describe("changeQuestionType", () => {
	it("drops fields that the new type does not use", () => {
		const changed = changeQuestionType(
			question("a", { type: "options", options: ["x", "y"], allowOther: true }),
			"yesNo",
		);
		expect(changed).toEqual({ key: "a", type: "yesNo", label: "a", required: true });
	});

	it("gives a new options question two default options", () => {
		expect(changeQuestionType(question("a"), "options")).toMatchObject({
			type: "options",
			options: ["Alternativ 1", "Alternativ 2"],
			allowOther: false,
		});
	});

	it("keeps existing values when the type stays the same", () => {
		const rating = question("a", { type: "rating", low: "Dårlig", high: "Bra" });
		expect(changeQuestionType(rating, "rating")).toMatchObject({ low: "Dårlig", high: "Bra" });
	});

	it("gives rating and text questions empty texts", () => {
		expect(changeQuestionType(question("a", { type: "yesNo" }), "rating")).toMatchObject({
			low: "",
			high: "",
		});
		expect(changeQuestionType(question("a", { type: "yesNo" }), "text")).toMatchObject({
			placeholder: "",
		});
	});
});

describe("options", () => {
	const options = question("a", { type: "options", options: ["x", "y", "z"] });

	it("adds a numbered option", () => {
		expect(addOption(options).options).toEqual(["x", "y", "z", "Alternativ 4"]);
	});

	it("stops adding at the option limit", () => {
		const full = question("a", {
			type: "options",
			options: Array.from({ length: maxOptions }, (_, index) => `o${index}`),
		});
		expect(addOption(full)).toBe(full);
	});

	it("removes the option at the index", () => {
		expect(removeOption(options, 1).options).toEqual(["x", "z"]);
	});

	it("keeps the minimum number of options", () => {
		const minimal = question("a", {
			type: "options",
			options: Array.from({ length: minOptions }, (_, index) => `o${index}`),
		});
		expect(removeOption(minimal, 0)).toBe(minimal);
	});
});
