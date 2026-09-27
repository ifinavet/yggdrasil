import { z } from "zod";

export const reportAccessDeniedMessage =
	"Du må være arrangør for dette arrangementet for å se rapporten.";

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
export type RegistrantStatistics = Record<string, Record<string, Record<string, number>>>;

export interface FeedbackReport {
	registrants?: RegistrantStatistics;
	eventTitle: string;
	eventStart: number;
	companyName: string;
	companyLogoUrl: string | null;
	totalResponses: number;
	questions: ReportQuestion[];
}

function reportBuckets(field: FeedbackField): ReportBucket[] {
	if (field.type === "rating")
		return [5, 4, 3, 2, 1].map((value) => ({
			value: String(value),
			label: String(value),
			count: 0,
		}));
	if (field.type === "yesNo")
		return [
			{ value: "ja", label: "Ja", count: 0 },
			{ value: "nei", label: "Nei", count: 0 },
		];
	const buckets = (field.options ?? []).map((value) => ({ value, label: value, count: 0 }));
	// Empty option labels are rejected by form validation, leaving this value available for custom answers.
	if (field.type === "options" && field.allowOther)
		buckets.push({ value: "", label: "Annet", count: 0 });
	return buckets;
}

export function createReportQuestions(fields: FeedbackField[]): ReportQuestion[] {
	return fields.map((field) => ({ ...field, answered: 0, buckets: reportBuckets(field) }));
}

function addChoiceAnswers(question: ReportQuestion, answer: FeedbackAnswers[string]) {
	const textAnswers: { fieldKey: string; text: string }[] = [];
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
	return textAnswers;
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
		textAnswers.push(...addChoiceAnswers(question, answer));
	}
	return textAnswers;
}

export function highlightTotals(questions: readonly ReportQuestion[]) {
	const satisfaction = questions.find(
		(question) => question.key === "satisfaction" && question.type === "rating",
	);
	const employment = questions.find(
		(question) => question.key === "want_to_work" && question.type === "yesNo",
	);
	return {
		ratingSum:
			satisfaction?.buckets.reduce(
				(total, bucket) => total + Number(bucket.value) * bucket.count,
				0,
			) ?? 0,
		ratings: satisfaction?.answered ?? 0,
		wantToWork: employment?.buckets.find((bucket) => bucket.value === "ja")?.count ?? 0,
		employmentAnswers: employment?.answered ?? 0,
	};
}

export type HighlightTotals = ReturnType<typeof highlightTotals>;

export function reportHighlights(report: FeedbackReport) {
	const { ratingSum, ratings, wantToWork, employmentAnswers } = highlightTotals(report.questions);
	return {
		rating: ratings ? ratingSum / ratings : null,
		employment: employmentAnswers ? wantToWork / employmentAnswers : null,
	};
}
