import type { FeedbackAnswers, FeedbackField } from "./schema";

export * from "./schema";

export function emptyFeedbackAnswers(fields: FeedbackField[]): FeedbackAnswers {
	return Object.fromEntries(fields.map((field) => [field.key, field.type === "options" ? [] : ""]));
}

/** Untrusted email query parameters only select a rating; they never submit it. */
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
