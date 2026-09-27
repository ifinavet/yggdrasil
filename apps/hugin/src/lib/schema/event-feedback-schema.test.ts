import { FieldApi, FormApi } from "@tanstack/react-form";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { optionsQuestion, requiredFieldNames } from "../event-feedback-questions";
import { eventResponseFromSchema, missingRequiredFields } from "./event-feedback-schema";

const valid: z.input<typeof eventResponseFromSchema> = {
	satisfaction: 5,
	impression: 4,
	expectation: 3,
	toughts: "Bra arrangement",
	improvements: "Mer tid til spørsmål",
	want_to_work: "ja",
	word_of_mouth: [optionsQuestion.options[0]],
	other: "",
};

describe("feedback React Form validation", () => {
	it("blocks invalid submissions, exposes field errors, then submits corrected answers", async () => {
		const onSubmit = vi.fn();
		const form = new FormApi({
			defaultValues: { ...valid, satisfaction: 0, toughts: " " },
			validators: { onSubmit: eventResponseFromSchema },
			onSubmit,
		});
		const unmount = form.mount();
		const rating = new FieldApi({ form, name: "satisfaction" });
		const text = new FieldApi({ form, name: "toughts" });
		const unmountRating = rating.mount();
		const unmountText = text.mount();
		try {
			await form.handleSubmit();
			expect(onSubmit).not.toHaveBeenCalled();
			expect(form.state.errorMap.onSubmit).toHaveProperty("satisfaction");
			expect(form.state.errorMap.onSubmit).toHaveProperty("toughts");
			expect(missingRequiredFields(form.state.values)).toEqual(["satisfaction", "toughts"]);
			rating.handleChange(5);
			text.handleChange(valid.toughts);
			await form.handleSubmit();
			expect(onSubmit).toHaveBeenCalledOnce();
			expect(onSubmit.mock.calls[0]?.[0].value).toEqual(valid);
			expect(missingRequiredFields(form.state.values)).toEqual([]);
		} finally {
			unmountText();
			unmountRating();
			unmount();
		}
	});

	it("reports all missing required questions in display order", () => {
		expect(missingRequiredFields({})).toEqual([...requiredFieldNames]);
	});

	it.each([
		{ word_of_mouth: ["Annet", "To andre"] },
		{ word_of_mouth: [optionsQuestion.options[0], optionsQuestion.options[0]] },
		{ word_of_mouth: [" "] },
		{ other: "x".repeat(1001) },
		{ unexpected: "value" },
	])("rejects invalid answer payloads %j", (patch) => {
		expect(eventResponseFromSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
	});

	it("allows one other option and an empty optional answer", () => {
		expect(
			eventResponseFromSchema.safeParse({ ...valid, word_of_mouth: ["En venn"] }).success,
		).toBe(true);
	});
});
