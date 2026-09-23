import { z } from "zod";

export const reportRecipientSchema = z.object({
	recipientEmail: z.string().trim().max(254).pipe(z.email("Skriv inn en gyldig e-postadresse.")),
});

import type { FeedbackAnswers, FeedbackField } from "./validation";

export interface ReportBucket {
	value: string;
	label: string;
	count: number;
}
export interface ReportQuestion extends FeedbackField {
	answered: number;
	buckets: ReportBucket[];
}
export interface ReportTextAnswer {
	id: string;
	fieldKey: string;
	text: string;
	visible: boolean;
}
export interface FeedbackReport {
	eventTitle: string;
	eventStart: number;
	companyName: string;
	companyLogoUrl: string | null;
	totalResponses: number;
	questions: ReportQuestion[];
}

export function createReportQuestions(fields: FeedbackField[]): ReportQuestion[] {
	return fields.map((field) => {
		const choices =
			field.type === "rating"
				? [5, 4, 3, 2, 1].map(String)
				: field.type === "yesNo"
					? ["ja", "nei"]
					: (field.options ?? []);
		const buckets = choices.map((value) => ({
			value,
			label: field.type === "yesNo" ? (value === "ja" ? "Ja" : "Nei") : value,
			count: 0,
		}));
		// The reserved value cannot collide with a real option: custom text uses a separate bucket.
		if (field.type === "options" && field.allowOther)
			buckets.push({ value: "", label: "Annet", count: 0 });
		return { ...field, answered: 0, buckets };
	});
}

/** Called once per response while the closed campaign is materialized in bounded batches. */
export function addResponseToReport(questions: ReportQuestion[], data: FeedbackAnswers) {
	const textAnswers: { fieldKey: string; text: string }[] = [];
	for (const question of questions) {
		const answer: FeedbackAnswers[string] | undefined = Object.getOwnPropertyDescriptor(
			data,
			question.key,
		)?.value;
		if (answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0))
			continue;
		question.answered += 1;
		if (question.type === "text") {
			textAnswers.push({ fieldKey: question.key, text: String(answer) });
			continue;
		}
		const values = Array.isArray(answer) ? answer : [String(answer)];
		for (const value of values) {
			const bucket = question.buckets.find((item) => item.value === value);
			if (bucket) bucket.count += 1;
			else if (question.type === "options" && question.allowOther) {
				const otherBucket = question.buckets.find((item) => item.value === "");
				if (otherBucket) otherBucket.count += 1;
				textAnswers.push({ fieldKey: question.key, text: value });
			}
		}
	}
	return textAnswers;
}

export function reportHighlights(report: FeedbackReport) {
	const satisfaction = report.questions.find(
		(question) => question.key === "satisfaction" && question.type === "rating",
	);
	const employment = report.questions.find(
		(question) => question.key === "want_to_work" && question.type === "yesNo",
	);
	return {
		rating: satisfaction?.answered
			? satisfaction.buckets.reduce(
					(total, bucket) => total + Number(bucket.value) * bucket.count,
					0,
				) / satisfaction.answered
			: null,
		employment: employment?.answered
			? (employment.buckets.find((bucket) => bucket.value === "ja")?.count ?? 0) /
				employment.answered
			: null,
	};
}
