import Papa from "papaparse";
import { degreeName } from "../constants";
import { fromBase64 } from "../utils/base";
import type { FeedbackReport, ReportTextAnswer } from "./report";

export function feedbackReportCsv(report: FeedbackReport, answers: ReportTextAnswer[]): string {
	const rows: (string | number)[][] = [];
	for (const [degree, programs] of Object.entries(report.registrants ?? {})) {
		for (const [program, years] of Object.entries(programs)) {
			for (const [year, count] of Object.entries(years)) {
				rows.push([`Grad: ${degreeName(degree)}`, `${fromBase64(program)}, år ${year}`, count]);
			}
		}
	}
	for (const question of report.questions) {
		for (const bucket of question.buckets) rows.push([question.label, bucket.label, bucket.count]);
		for (const answer of answers) {
			if (answer.visible && answer.fieldKey === question.key)
				rows.push([question.label, answer.text, ""]);
		}
	}
	return `\uFEFF${Papa.unparse({ fields: ["Spørsmål", "Svar", "Antall"], data: rows }, { delimiter: ";", escapeFormulae: true })}`;
}
