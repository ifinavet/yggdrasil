import { FieldApi, FormApi } from "@tanstack/react-form";
import {
	emptyFeedbackAnswers,
	type FeedbackField,
	feedbackAnswersSchema,
} from "@workspace/shared/feedback";
import { describe, expect, it, vi } from "vitest";
import { feedbackProgress, readFeedbackToken, tokenFeedbackValidator } from "./form";

const fields: FeedbackField[] = [
	{ key: "rating", type: "rating", label: "Rating", required: true },
	{ key: "text", type: "text", label: "Text", required: true },
	{ key: "yes", type: "yesNo", label: "Yes", required: true },
	{
		key: "choices",
		type: "options",
		label: "Choices",
		required: true,
		options: ["One", "Two"],
		allowOther: true,
	},
	{ key: "optional", type: "rating", label: "Optional", required: false },
];
describe("token feedback form", () => {
	it.each(["", "#token=short", "#other=value", `#token=${"a".repeat(257)}`])(
		"rejects invalid invitation fragments: %s",
		(fragment) => {
			expect(readFeedbackToken(fragment)).toBeNull();
		},
	);
	it("reads only a valid token and does not turn rating query parameters into an answer", () => {
		const token = "a".repeat(32);
		expect(readFeedbackToken(`#token=${token}&rating=5`)).toBe(token);
		expect(emptyFeedbackAnswers(fields).rating).toBe("");
	});
	it("counts valid required answers, excluding optional fields", () => {
		expect(feedbackProgress(fields, emptyFeedbackAnswers(fields))).toEqual({
			total: 4,
			answered: 0,
		});
		expect(
			feedbackProgress(fields, {
				rating: 5,
				text: "Bra",
				yes: "ja",
				choices: ["One"],
				optional: "",
			}),
		).toEqual({ total: 4, answered: 4 });
		expect(
			feedbackProgress(fields, { rating: 6, text: " ", yes: "wrong", choices: [], optional: 4 }),
		).toEqual({ total: 4, answered: 0 });
		expect(feedbackProgress([], {})).toEqual({ total: 0, answered: 0 });
	});
	it("blocks missing answers, renders field errors, and allows correction and retry without losing values", async () => {
		const submit = vi
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce({ status: "submitted" });
		const failures = vi.fn();
		const form = new FormApi({
			defaultValues: emptyFeedbackAnswers(fields),
			validators: { onSubmit: tokenFeedbackValidator(fields) },
			onSubmit: async ({ value }) => {
				try {
					await submit(value);
				} catch {
					failures();
				}
			},
		});
		const cleanups = [form.mount()];
		const controls = fields.map((question) => new FieldApi({ form, name: question.key }));
		cleanups.push(...controls.map((control) => control.mount()));
		try {
			await form.handleSubmit();
			expect(submit).not.toHaveBeenCalled();
			for (const control of controls.slice(0, 4))
				expect(control.state.meta.errors.length).toBeGreaterThan(0);
			const answers = [5, "Bra", "ja", ["One", "Annet sted"], ""];
			controls.forEach((control, index) => {
				control.handleChange(answers[index] as string | number | string[]);
			});
			await form.handleSubmit();
			expect(failures).toHaveBeenCalledOnce();
			expect(form.state.values.text).toBe("Bra");
			await form.handleSubmit();
			expect(submit).toHaveBeenCalledTimes(2);
			expect(submit.mock.calls[1]?.[0]).toEqual(form.state.values);
		} finally {
			for (const cleanup of cleanups.reverse()) cleanup();
		}
	});
	it("validates optional answers when present and restricts other options to configured questions", () => {
		const answers = { rating: 5, text: "Bra", yes: "ja", choices: ["Other"], optional: "" };
		expect(feedbackAnswersSchema(fields).safeParse(answers).success).toBe(true);
		expect(feedbackAnswersSchema(fields).safeParse({ ...answers, optional: 6 }).success).toBe(
			false,
		);
		expect(
			feedbackAnswersSchema(fields.map((field) => ({ ...field, allowOther: false }))).safeParse(
				answers,
			).success,
		).toBe(false);
	});
});
