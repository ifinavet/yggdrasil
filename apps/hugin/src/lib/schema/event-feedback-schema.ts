import {
	feedbackOptionsSchema,
	feedbackRatingSchema,
	feedbackTextSchema,
	feedbackYesNoSchema,
} from "@workspace/shared/feedback";
import { z } from "zod";
import { optionsQuestion, requiredFieldNames } from "../event-feedback-questions";

export const eventResponseFromSchema = z.strictObject({
	satisfaction: feedbackRatingSchema,
	impression: feedbackRatingSchema,
	expectation: feedbackRatingSchema,
	toughts: feedbackTextSchema,
	improvements: feedbackTextSchema,
	want_to_work: feedbackYesNoSchema,
	word_of_mouth: feedbackOptionsSchema(optionsQuestion.options, true),
	other: z.union([z.literal(""), feedbackTextSchema]),
});

/**
 * Required questions whose answer is still missing or invalid, in question order.
 *
 * The rules come from the same schema that guards submission, so the progress
 * counter and the send button can never disagree with the validator.
 */
export function missingRequiredFields(values: unknown): string[] {
	const result = eventResponseFromSchema.safeParse(values);
	if (result.success) return [];

	const invalid = new Set(result.error.issues.map((issue) => String(issue.path[0])));

	return requiredFieldNames.filter((field) => invalid.has(field));
}
