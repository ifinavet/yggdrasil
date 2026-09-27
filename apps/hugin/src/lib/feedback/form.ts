import {
	type FeedbackAnswers,
	type FeedbackField,
	feedbackErrors,
	feedbackTokenSchema,
} from "@workspace/shared/feedback";

export function tokenFeedbackValidator(fields: FeedbackField[]) {
	return ({ value }: { value: FeedbackAnswers }) => {
		const errors = feedbackErrors(fields, value);
		return Object.keys(errors).length > 0 ? { fields: errors } : undefined;
	};
}

export function readFeedbackToken(fragment: string) {
	const token = new URLSearchParams(fragment.replace(/^#/, "")).get("token");
	const result = feedbackTokenSchema.safeParse(token);
	return result.success ? result.data : null;
}

export function feedbackProgress(fields: FeedbackField[], answers: FeedbackAnswers) {
	const errors = feedbackErrors(fields, answers);
	const required = fields.filter((field) => field.required);
	return {
		total: required.length,
		answered: required.filter((field) => !Object.hasOwn(errors, field.key)).length,
	};
}
