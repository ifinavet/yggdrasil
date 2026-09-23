"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { emptyFeedbackAnswers } from "@workspace/shared/feedback";
import { Button } from "@workspace/ui/components/button";
import { FieldError } from "@workspace/ui/components/field";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useRef, useState } from "react";
import { feedbackCopy } from "@/lib/feedback/copy";
import { feedbackProgress, tokenFeedbackValidator } from "@/lib/feedback/form";
import { FeedbackQuestion } from "./feedback-question";

type OpenFeedback = Extract<
	FunctionReturnType<typeof api.feedback.responses.actions.resolveFeedbackToken>,
	{ status: "open" }
>;
type Submission = FunctionReturnType<
	typeof api.feedback.responses.mutations.submitFeedbackResponse
>;
export function TokenFeedbackForm({
	token,
	feedback,
	onComplete,
}: Readonly<{
	token: string;
	feedback: OpenFeedback;
	onComplete: (result: Exclude<Submission, { status: "validation-error" }>) => void;
}>) {
	const submit = useMutation(api.feedback.responses.mutations.submitFeedbackResponse);
	const [submitError, setSubmitError] = useState<string>();
	const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
	const formElement = useRef<HTMLFormElement>(null);
	const fields = feedback.form.fields;
	const form = useForm({
		defaultValues: emptyFeedbackAnswers(fields),
		validators: { onSubmit: tokenFeedbackValidator(fields) },
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			setServerErrors({});
			try {
				const result = await submit({ token, answers: value });
				if (result.status === "validation-error") {
					setServerErrors(result.errors);
					setSubmitError(feedbackCopy.validationError);
					return;
				}
				onComplete(result);
			} catch {
				setSubmitError(feedbackCopy.submitError);
			}
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const progress = feedbackProgress(fields, values);
	return (
		<div className="mx-auto w-full max-w-3xl">
			<h1 className="mb-1.5 font-bold text-[21px] text-primary">{feedback.event.title}</h1>
			<p className="mb-3 text-muted-foreground text-sm">
				{format(feedback.event.eventStart, "EEEE d. MMMM", { locale: nb })}
			</p>
			<p className="mb-4 text-sm">{feedbackCopy.introduction}</p>
			<form
				ref={formElement}
				noValidate
				onSubmit={async (event) => {
					event.preventDefault();
					await form.handleSubmit();
					formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
				}}
			>
				<output
					className="sticky top-0 z-4 block bg-background py-3 text-muted-foreground text-sm"
					aria-live="polite"
				>
					{progress.answered} av {progress.total} obligatoriske spørsmål besvart
				</output>
				<fieldset disabled={isSubmitting} className="min-w-0 pb-8">
					{fields.map((question, index) => (
						<form.Field key={question.key} name={question.key}>
							{(field) => (
								<div>
									<FeedbackQuestion field={field} question={question} number={index + 1} />
									{serverErrors[question.key] && (
										<FieldError>{serverErrors[question.key]}</FieldError>
									)}
								</div>
							)}
						</form.Field>
					))}
				</fieldset>
				{submitError && (
					<p role="alert" className="mb-3 text-destructive text-sm">
						{submitError}
					</p>
				)}
				<div className="sticky bottom-0 border-t bg-background py-3">
					<Button
						type="submit"
						disabled={isSubmitting}
						className="h-[52px] w-full rounded-[13px] font-semibold"
					>
						{isSubmitting ? feedbackCopy.submitting : feedbackCopy.submit}
					</Button>
				</div>
			</form>
		</div>
	);
}
