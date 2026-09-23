import Papa from "papaparse";
import type { FeedbackReport, ReportTextAnswer } from "./report";

export function feedbackReportCsv(report: FeedbackReport, answers: ReportTextAnswer[]): string {
	const rows: (string | number)[][] = [];
	for (const question of report.questions) {
		for (const bucket of question.buckets) rows.push([question.label, bucket.label, bucket.count]);
		for (const answer of answers) {
			if (answer.visible && answer.fieldKey === question.key)
				rows.push([question.label, answer.text, ""]);
		}
	}
	return `\uFEFF${Papa.unparse({ fields: ["Spørsmål", "Svar", "Antall"], data: rows }, { delimiter: ";", escapeFormulae: true })}`;
}
