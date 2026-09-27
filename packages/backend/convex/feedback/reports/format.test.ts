import {
	addResponseToReport,
	createReportQuestions,
	type FeedbackReport,
	reportHighlights,
	reportRecipientSchema,
} from "@workspace/shared/feedback/report";
import { feedbackReportCsv } from "@workspace/shared/feedback/report-csv";
import { describe, expect, it } from "vitest";
import { defaultFeedbackFields } from "../defaultFields";

function emptyReport(): FeedbackReport {
	return {
		eventTitle: "Bedriftspresentasjon",
		eventStart: Date.UTC(2026, 8, 8),
		companyName: "Eksempel",
		companyLogoUrl: null,
		totalResponses: 0,
		questions: createReportQuestions(defaultFeedbackFields),
	};
}
describe("report aggregation and CSV", () => {
	it("counts all field types and separates every custom answer", () => {
		const report = emptyReport();
		const text = addResponseToReport(report.questions, {
			satisfaction: 5,
			impression: 4,
			expectation: 3,
			toughts: "Bra",
			improvements: "Mer tid",
			want_to_work: "ja",
			word_of_mouth: ["Instagram", "En plakat"],
			other: "",
		});
		expect(text).toEqual([
			{ fieldKey: "toughts", text: "Bra" },
			{ fieldKey: "improvements", text: "Mer tid" },
			{ fieldKey: "word_of_mouth", text: "En plakat" },
		]);
		expect(
			report.questions.find((q) => q.key === "word_of_mouth")?.buckets.filter((b) => b.count > 0),
		).toEqual([
			{ value: "Instagram", label: "Instagram", count: 1 },
			{ value: "", label: "Annet", count: 1 },
		]);
		expect(reportHighlights(report)).toEqual({ rating: 5, employment: 1 });
	});
	it("omits missing, inherited and blank optional answers without fabricating statistics", () => {
		const report = emptyReport();
		const data = Object.create({ satisfaction: 5 });
		data.word_of_mouth = [];
		data.other = "";
		expect(addResponseToReport(report.questions, data)).toEqual([]);
		expect(report.questions.every((q) => q.answered === 0)).toBe(true);
		expect(reportHighlights(report)).toEqual({ rating: null, employment: null });
		report.questions = createReportQuestions([
			{ key: "custom", label: "Custom", type: "options", required: false },
		]);
		expect(addResponseToReport(report.questions, { custom: ["unexpected"] })).toEqual([]);
		expect(reportHighlights(report)).toEqual({ rating: null, employment: null });
	});
	it("exports only visible values and protects formulas while preserving semicolons, quotes and newlines", () => {
		const report = emptyReport();
		const visible = ["=1+1", "+SUM(1;2)", "-2+3", "@SUM(1)", 'tekst; med "sitat"\nog ny linje'];
		const answers = visible.map((text, index) => ({
			id: String(index),
			fieldKey: "toughts",
			text,
			visible: true,
		}));
		const csv = feedbackReportCsv(report, [
			...answers,
			{ id: "hidden", fieldKey: "toughts", text: "PRIVATE", visible: false },
		]);
		expect(csv.startsWith("\uFEFF")).toBe(true);
		expect(csv).toContain("Spørsmål;Svar;Antall\r\n");
		expect(csv).toContain(`;"'=1+1";`);
		expect(csv).toContain(`;"'+SUM(1;2)";`);
		expect(csv).toContain(`;"'-2+3";`);
		expect(csv).toContain(`;"'@SUM(1)";`);
		expect(csv).toContain(';"tekst; med ""sitat""\nog ny linje";');
		expect(csv).not.toContain("PRIVATE");
	});
	it("validates and normalizes contact email with Zod", () => {
		expect(reportRecipientSchema.parse({ recipientEmail: " contact@example.test " })).toEqual({
			recipientEmail: "contact@example.test",
		});
		for (const recipientEmail of ["", "not an email", `${"a".repeat(255)}@example.test`])
			expect(reportRecipientSchema.safeParse({ recipientEmail }).success).toBe(false);
	});
});
