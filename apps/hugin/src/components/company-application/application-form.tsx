"use client";

import { useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { semesterName } from "@workspace/shared/semester/labels";
import { osloToday } from "@workspace/shared/semester/time";
import { cn } from "@workspace/ui/lib/utils";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Note } from "@/components/form-controls";
import { FormProgress } from "@/components/form-progress";
import { SubmitDock } from "@/components/submit-dock";
import {
	answeredCount,
	draftErrors,
	emptyDraft,
	firstInvalidQuestion,
	REQUIRED_QUESTIONS,
} from "@/lib/company-application";
import { fullDate } from "@/lib/company-application-format";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import {
	clearDraft,
	loadDraft,
	newSubmissionId,
	receiptOf,
	saveReceipt,
} from "@/lib/company-application-storage";
import { companyErrorMessage, UNEXPECTED_COMPANY_ERROR } from "@/lib/company-error-message";
import { focusQuestion } from "@/lib/focus-question";
import { BillingQuestions } from "./billing-questions";
import { CompanyQuestions } from "./company-questions";
import { DateQuestions } from "./date-questions";
import { EventQuestions } from "./event-questions";
import { PracticalQuestions } from "./practical-questions";
import { useApplicationForm } from "./use-application-form";
import { useDraftAutosave } from "./use-draft-autosave";

export type OpenSemester = NonNullable<
	FunctionReturnType<typeof api.semesterPlanning.semesters.queries.getOpenForApplications>
>;

/** The Hugin application form for the open semester, saved as a draft while it is filled in. */
export function ApplicationForm({ semester }: Readonly<{ semester: OpenSemester }>) {
	const router = useRouter();
	const submit = useAction(api.semesterPlanning.applications.submit.submit);

	const [initial] = useState(
		() => loadDraft(semester._id) ?? { submissionId: newSubmissionId(), values: emptyDraft() },
	);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const honeypot = useRef<HTMLInputElement>(null);
	const formElement = useRef<HTMLFormElement>(null);
	const sent = useRef(false);

	const semesterLabel = semesterName(semester.term, semester.year);
	const late = osloToday(Date.now()) > semester.applicationDeadline;

	const form = useApplicationForm({
		defaultValues: initial.values,
		onSubmit: async (application, draft) => {
			const fail = (message: string) => {
				setSubmitError(message);
				toast.error(COPY.submit.failedTitle, { description: message });
			};
			setSubmitError(null);
			// The schema only passes a draft with a company; this keeps the types honest.
			const { company } = draft;
			if (!company) return fail(UNEXPECTED_COMPANY_ERROR);

			try {
				await submit({
					form: application,
					submissionId: initial.submissionId,
					website: honeypot.current?.value || undefined,
				});
			} catch (error) {
				return fail(companyErrorMessage(error));
			}

			sent.current = true;
			saveReceipt(
				receiptOf({
					form: application,
					company,
					applicationDeadline: semester.applicationDeadline,
					late,
				}),
			);
			clearDraft();
			router.push("/bestill-bedpres/kvittering");
		},
		onSubmitInvalid: (draft) => {
			setSubmitError(null);
			const first = firstInvalidQuestion(draftErrors(draft));
			if (first) focusQuestion(formElement.current, first);
		},
	});

	const values = useStore(form.store, (state) => state.values);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const attempted = useStore(form.store, (state) => state.submissionAttempts > 0);

	const answered = useMemo(() => answeredCount(draftErrors(values)), [values]);
	const missing = REQUIRED_QUESTIONS.length - answered;
	const showMissing = attempted && missing > 0;

	// Drop chosen dates that Navet has closed since, also in a restored draft.
	useEffect(() => {
		const open = new Set(semester.dates);
		const chosen = form.getFieldValue("availableDates");
		const kept = chosen.filter((date) => open.has(date));
		if (kept.length !== chosen.length) form.setFieldValue("availableDates", kept);
	}, [semester.dates, form]);

	const draft = useMemo(
		() => ({ semesterId: semester._id, submissionId: initial.submissionId, values }),
		[semester._id, initial.submissionId, values],
	);
	useDraftAutosave(draft, sent);

	return (
		<>
			<div className="pt-1.5">
				<p className="m-0 font-semibold text-[13.5px] text-muted-foreground">{semesterLabel}</p>
				<h1 className="m-0 mt-0.5 font-bold text-[21px] text-primary leading-[1.22] tracking-[-0.015em] dark:text-primary-foreground">
					{COPY.title}
				</h1>
				<Deadline date={semester.applicationDeadline} late={late} />
				<p className="m-0 mt-3.5 text-[14.5px] leading-normal">{COPY.lede}</p>
				{semester.infoText && (
					<Note className="mt-3.5">
						<span className="whitespace-pre-line">{semester.infoText}</span>
					</Note>
				)}
			</div>

			<form
				ref={formElement}
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
				noValidate
				className="flex flex-1 flex-col"
			>
				<div className="flex-1 pb-6">
					<FormProgress answered={answered} total={REQUIRED_QUESTIONS.length} />

					{/* Bots fill in every field; people never see this one. Its name is one autofill
					    does not recognise, so a browser does not fill it in for a person either. */}
					<div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
						<label>
							{COPY.honeypot}
							<input
								ref={honeypot}
								name="navet-hp-field"
								type="text"
								tabIndex={-1}
								autoComplete="off"
								data-1p-ignore
								data-lpignore="true"
							/>
						</label>
					</div>

					<CompanyQuestions form={form} />
					<EventQuestions form={form} />
					<DateQuestions form={form} dates={semester.dates} />
					<PracticalQuestions form={form} />
					<BillingQuestions form={form} termsUrl={semester.termsUrl} />

					{showMissing && (
						<Note tone="bad" role="alert" className="mt-6">
							{COPY.submit.summary(missing)}
						</Note>
					)}
					{submitError && (
						<Note tone="bad" role="alert" className="mt-6">
							<b className="block">{COPY.submit.failedTitle}</b>
							{submitError}
						</Note>
					)}
				</div>

				<SubmitDock
					bleed
					label={COPY.submit.idle}
					busyLabel={COPY.submit.busy}
					isSubmitting={isSubmitting}
					status={
						showMissing
							? COPY.submit.missing(missing)
							: `${answered} / ${REQUIRED_QUESTIONS.length}`
					}
					statusIsError={showMissing}
				/>
			</form>
		</>
	);
}

/** The application deadline, set apart under the heading. Once it has passed, it says so. */
function Deadline({ date, late }: Readonly<{ date: string; late: boolean }>) {
	return (
		<div
			className={cn(
				"mt-3.5 flex gap-2.5 rounded-xl border px-[14px] py-3",
				late
					? "border-[color-mix(in_oklab,var(--warning)_45%,var(--border))] bg-[color-mix(in_oklab,var(--warning)_10%,var(--card))]"
					: "border-border bg-card",
			)}
		>
			<CalendarClock
				aria-hidden
				className="mt-0.5 size-[18px] flex-none text-primary dark:text-primary-foreground"
			/>
			<div className="min-w-0">
				<p className="m-0 text-[15px] tabular-nums leading-[1.35]">
					{late ? COPY.deadlinePassed : COPY.deadline}{" "}
					<b className="font-bold text-primary dark:text-primary-foreground">{fullDate(date)}</b>
				</p>
				{late && <p className="m-0 mt-1 text-[13.5px] leading-[1.45]">{COPY.lateNotice}</p>}
			</div>
		</div>
	);
}
