"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { reportRecipientSchema } from "@workspace/shared/feedback/report";
import { formatFeedbackDate } from "@workspace/shared/feedback/time";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { FeedbackReportView } from "@workspace/ui/components/feedback/report";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type ReportResult = Extract<
	NonNullable<FunctionReturnType<typeof api.feedback.reports.queries.getEventReport>>,
	{ enabled: true }
>;
type Report = NonNullable<ReportResult["report"]>;
type Answers = FunctionReturnType<typeof api.feedback.reports.queries.getReportAnswers>["page"];

function reportStatusLabel(report: Report): string {
	if (report.status === "revoked") return "Tilgangen er trukket tilbake";
	if (report.status === "draft") return "Klar for gjennomgang";
	const deliveryLabels = {
		failed: "E-post feilet",
		delivered: "E-post levert",
		pending: "Klargjør e-post",
		queued: "E-post i kø",
	};
	return deliveryLabels[report.deliveryStatus ?? "pending"];
}

export function ReportReview({
	report,
	answers,
	deliveryEnabled,
}: Readonly<{ report: Report; answers: Answers; deliveryEnabled: boolean }>) {
	const setVisibility = useMutation(api.feedback.reports.mutations.setAnswerVisibility);
	const approve = useMutation(api.feedback.reports.mutations.approve);
	const retry = useMutation(api.feedback.reports.mutations.retryDelivery);
	const revoke = useMutation(api.feedback.reports.mutations.revoke);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const locked = report.status !== "draft";
	async function perform(operation: () => Promise<unknown>) {
		setBusy(true);
		setError(undefined);
		try {
			await operation();
		} catch (cause) {
			setError(
				cause instanceof ConvexError
					? String(cause.data)
					: "Kunne ikke lagre endringen. Prøv igjen.",
			);
		} finally {
			setBusy(false);
		}
	}
	const form = useForm({
		defaultValues: { recipientEmail: report.recipientEmail },
		validators: { onSubmit: reportRecipientSchema },
		onSubmit: async ({ value }) =>
			perform(() => approve({ reportId: report._id, revision: report.revision, ...value })),
	});
	const status = reportStatusLabel(report);
	return (
		<div className="w-full space-y-6">
			<div className="flex flex-wrap items-start gap-4">
				<div className="min-w-0 flex-1">
					<h1 className="font-semibold text-3xl">Se gjennom før du deler</h1>
				</div>
				<Badge variant="secondary">{status}</Badge>
			</div>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
				<form
					className="min-w-0 rounded-[10px] border bg-card"
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<fieldset disabled={busy} className="min-w-0 p-6">
						<h2 className="font-semibold text-xl">Rapport for {report.companyName}</h2>
						<p className="mt-2 text-muted-foreground">
							<span className="block">{report.eventTitle}</span>
							<span className="block">{formatFeedbackDate(report.eventStart, "d. MMMM yyyy")}</span>
						</p>
						<form.Field name="recipientEmail">
							{(field) => (
								<Field className="my-7">
									<FieldLabel htmlFor="report-recipient">Send rapporten til</FieldLabel>
									<Input
										id="report-recipient"
										type="email"
										required
										disabled={locked}
										value={locked ? report.recipientEmail : field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							)}
						</form.Field>
						<div className="flex items-center justify-between gap-3">
							<h2 className="font-semibold text-xl">Tekstsvar</h2>
							<Badge variant="secondary">
								{answers.filter((answer) => !answer.visible).length} skjult
							</Badge>
						</div>
						{report.questions
							.filter((question) => question.type === "text" || question.allowOther)
							.map((question) => (
								<section key={question.key} className="mt-6">
									<h3 className="mb-3 font-semibold">
										{question.label}
										{question.allowOther ? (
											<span className="block font-normal text-muted-foreground text-sm">Annet</span>
										) : null}
									</h3>
									{answers
										.filter((answer) => answer.fieldKey === question.key)
										.map((answer) => (
											<div
												key={answer.id}
												className={cn(
													"my-2 flex min-w-0 items-start gap-3 rounded-md p-3",
													!answer.visible && "bg-muted text-muted-foreground",
												)}
											>
												<blockquote className="wrap-break-word min-w-0 flex-1 whitespace-pre-wrap">
													{answer.text}
												</blockquote>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													disabled={locked}
													title={
														answer.visible ? "Skjul svaret fra rapporten" : "Vis svaret i rapporten"
													}
													aria-label={`${answer.visible ? "Skjul svaret fra rapporten" : "Vis svaret i rapporten"}: ${answer.text}`}
													aria-pressed={answer.visible}
													onClick={() =>
														void perform(() =>
															setVisibility({
																reportId: report._id,
																revision: report.revision,
																answerId: answer.id,
																visible: !answer.visible,
															}),
														)
													}
												>
													{answer.visible ? (
														<Eye aria-hidden="true" />
													) : (
														<EyeOff aria-hidden="true" />
													)}
												</Button>
											</div>
										))}
								</section>
							))}
						<div className="mt-7 space-y-3">
							{!deliveryEnabled && !locked ? (
								<p className="text-muted-foreground text-sm">
									E-postutsending er slått av. Rapporten kan gjennomgås, men ikke sendes.
								</p>
							) : null}
							{report.totalResponses === 0 ? (
								<p>Rapporten har ingen svar og kan ikke sendes.</p>
							) : null}
							{error ? (
								<p role="alert" className="text-destructive">
									{error}
								</p>
							) : null}
							{!locked ? (
								<Button type="submit" disabled={!deliveryEnabled || report.totalResponses === 0}>
									Godkjenn og send rapport
								</Button>
							) : null}
							{report.deliveryStatus === "failed" && report.status === "approved" ? (
								<>
									<p>Rapporten er godkjent, men e-posten ble ikke sendt. Prøv igjen.</p>
									<Button
										type="button"
										disabled={!deliveryEnabled}
										onClick={() =>
											void perform(() => retry({ reportId: report._id, revision: report.revision }))
										}
									>
										Prøv utsending på nytt
									</Button>
								</>
							) : null}
							{report.status === "approved" ? (
								<Button
									type="button"
									variant="outline"
									onClick={() =>
										void perform(() => revoke({ reportId: report._id, revision: report.revision }))
									}
								>
									Trekk tilbake tilgang
								</Button>
							) : null}
						</div>
					</fieldset>
				</form>
				<div className="min-w-0 overflow-hidden rounded-[10px] border bg-card">
					<div className="bg-muted/40 px-6 py-4 font-semibold">Dette ser bedriften</div>
					<FeedbackReportView report={report} answers={answers} allowExport={false} />
				</div>
			</div>
		</div>
	);
}
