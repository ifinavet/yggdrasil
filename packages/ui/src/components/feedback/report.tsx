"use client";

import type {
	FeedbackReport,
	ReportQuestion,
	ReportTextAnswer,
} from "@workspace/shared/feedback/report";
import { reportHighlights } from "@workspace/shared/feedback/report";
import { formatOsloDate } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { Download } from "lucide-react";
import Image from "next/image";
import { Progress } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";
import NavetLogo from "../../assets/navet/logo_n_blaa.webp";
import styles from "./report.module.css";
import { RegistrationStatistics } from "./registration-statistics";

function ReportDistribution({ question }: Readonly<{ question: ReportQuestion }>) {
	return (
		<div className={question.type === "options" ? styles.options : undefined}>
			{question.buckets.map((bucket) => (
				<div className={styles.barRow} key={bucket.value}>
					<span>{bucket.label}</span>
					<Progress.Root
						className={styles.track}
						value={bucket.count}
						max={Math.max(question.answered, 1)}
						aria-label={`${question.label}: ${bucket.label}`}
						getValueLabel={(value) => `${value} av ${question.answered} svar`}
					>
						<Progress.Indicator
							className={styles.fill}
							style={{ width: `${(bucket.count / Math.max(question.answered, 1)) * 100}%` }}
						/>
					</Progress.Root>
					<span className={styles.count}>{bucket.count}</span>
				</div>
			))}
		</div>
	);
}

export function FeedbackReportView({
	report,
	answers,
	className,
	allowExport = true,
}: Readonly<{
	report: FeedbackReport;
	answers: ReportTextAnswer[];
	className?: string;
	allowExport?: boolean;
}>) {
	const [exporting, setExporting] = useState(false);
	async function downloadCsv() {
		setExporting(true);
		try {
			const { feedbackReportCsv } = await import("@workspace/shared/feedback/report-csv");
			const csv = feedbackReportCsv(report, answers);
			const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
			const link = document.createElement("a");
			link.href = url;
			link.download = `rapport-bedriftspresentasjon-${formatOsloDate(report.eventStart, "yyyy-MM-dd")}.csv`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch {
			toast.error("Kunne ikke eksportere rapporten. Prøv igjen.");
		} finally {
			setExporting(false);
		}
	}
	return (
		<article className={cn(styles.report, className)}>
			<div className={styles.brands}>
				<Image src={NavetLogo} alt="Navet" className={styles.navetLogo} />
				{report.companyLogoUrl ? (
					<Image
						src={report.companyLogoUrl}
						alt={report.companyName}
						width={148}
						height={38}
						className={styles.companyLogo}
						unoptimized
					/>
				) : (
					<span className="font-semibold">{report.companyName}</span>
				)}
			</div>
			<h2 className={styles.heading}>Rapport fra bedriftspresentasjon</h2>
			<div className={styles.actions}>
				<p>{formatOsloDate(report.eventStart, "d. MMMM yyyy")}</p>
				{allowExport ? (
					<Button
						variant="outline"
						size="sm"
						className={styles.csvButton}
						onClick={downloadCsv}
						disabled={exporting}
					>
						<Download aria-hidden="true" />
						{exporting ? "Eksporterer…" : "Last ned CSV"}
					</Button>
				) : null}
			</div>
			{report.registrants ? (
				<div className="@container mb-8">
					<RegistrationStatistics data={report.registrants} />
				</div>
			) : null}
			<FeedbackReportResponses report={report} answers={answers} />
		</article>
	);
}

export function FeedbackReportResponses({
	report,
	answers,
}: Readonly<{ report: FeedbackReport; answers: ReportTextAnswer[] }>) {
	const highlights = reportHighlights(report);
	return (
		<>
			{" "}
			{report.totalResponses === 0 ? (
				<p className={styles.empty}>Ingen tilbakemeldinger ble sendt inn.</p>
			) : (
				<>
					<div className={styles.highlights} aria-label="Høydepunkter">
						<div>
							<strong>{report.totalResponses}</strong>
							<span>tilbakemeldinger</span>
						</div>
						{highlights.rating !== null ? (
							<div>
								<strong>
									{highlights.rating.toLocaleString("nb-NO", {
										minimumFractionDigits: 1,
										maximumFractionDigits: 1,
									})}{" "}
									<small>/ 5</small>
								</strong>
								<span>arrangementet</span>
							</div>
						) : null}
						{highlights.employment !== null ? (
							<div>
								<strong>{Math.round(highlights.employment * 100)} %</strong>
								<span>kan tenke seg å jobbe her</span>
							</div>
						) : null}
					</div>
					{report.questions.map((question) => {
						const textAnswers = answers.filter(
							(answer) => answer.visible && answer.fieldKey === question.key,
						);
						return (
							<section key={question.key} className={styles.question}>
								<h3>{question.label}</h3>
								<ReportDistribution question={question} />
								{question.type === "options" && textAnswers.length > 0 ? (
									<h4>Utdypinger fra «Annet»</h4>
								) : null}
								{textAnswers.map((answer) => (
									<blockquote key={answer.id}>{answer.text}</blockquote>
								))}
								{question.type === "text" && textAnswers.length === 0 ? (
									<p className={styles.muted}>Ingen tekstsvar deles for dette spørsmålet.</p>
								) : null}
							</section>
						);
					})}
				</>
			)}
		</>
	);
}
