import type { FeedbackAnswers, FeedbackField } from "./validation";

export { defaultFeedbackFields } from "./default-fields";
export * from "./validation";

export function emptyFeedbackAnswers(fields: FeedbackField[]): FeedbackAnswers {
	return Object.fromEntries(fields.map((field) => [field.key, field.type === "options" ? [] : ""]));
}

/** Prefill a valid 1–5 rating from an email link. The student still submits the form. */
export function feedbackPrefill(
	fields: FeedbackField[],
	key?: string,
	answer?: string,
): FeedbackAnswers {
	const values = emptyFeedbackAnswers(fields);
	const field = fields.find((item) => item.key === key && item.type === "rating");
	if (field && answer && /^[1-5]$/.test(answer)) values[field.key] = Number(answer);
	return values;
}
