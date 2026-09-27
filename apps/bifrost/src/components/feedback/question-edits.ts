import type { FeedbackField } from "@workspace/shared/feedback";

export type QuestionType = FeedbackField["type"];

export const questionTypeLabels: Record<QuestionType, string> = {
	rating: "Skala 1 til 5",
	text: "Fritekst",
	yesNo: "Ja/nei",
	options: "Flervalg",
};

export const maxQuestions = 40;
export const maxOptions = 30;
export const minOptions = 2;

function newQuestionKey() {
	return `question_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function createQuestion(): FeedbackField {
	return { key: newQuestionKey(), type: "text", label: "", required: true, placeholder: "" };
}

export function duplicateQuestion(fields: FeedbackField[], index: number): FeedbackField[] {
	const original = fields[index];
	if (!original || fields.length >= maxQuestions) return fields;
	const copy = { ...original, key: newQuestionKey(), options: original.options?.slice() };
	return [...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)];
}

export function moveQuestion(fields: FeedbackField[], from: number, to: number): FeedbackField[] {
	const moved = fields[from];
	if (!moved || from === to || to < 0 || to >= fields.length) return fields;
	const remaining = fields.filter((_, position) => position !== from);
	return [...remaining.slice(0, to), moved, ...remaining.slice(to)];
}

export function changeQuestionType(question: FeedbackField, type: QuestionType): FeedbackField {
	const { options, allowOther, low, high, placeholder, ...base } = question;
	switch (type) {
		case "rating":
			return { ...base, type, low: low ?? "", high: high ?? "" };
		case "text":
			return { ...base, type, placeholder: placeholder ?? "" };
		case "options":
			return {
				...base,
				type,
				options: options ?? ["Alternativ 1", "Alternativ 2"],
				allowOther: allowOther ?? false,
			};
		case "yesNo":
			return { ...base, type };
	}
}

export function addOption(question: FeedbackField): FeedbackField {
	const options = question.options ?? [];
	if (options.length >= maxOptions) return question;
	return { ...question, options: [...options, `Alternativ ${options.length + 1}`] };
}

export function removeOption(question: FeedbackField, index: number): FeedbackField {
	const options = question.options ?? [];
	if (options.length <= minOptions) return question;
	return { ...question, options: options.filter((_, position) => position !== index) };
}
