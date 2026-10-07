"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import {
	type CompanyInterest,
	companyInterestSchema,
	MAX_COMPANY_NAME_LENGTH,
} from "@workspace/shared/semester/interest";
import { Note } from "@workspace/ui/components/note";
import { useMutation } from "convex/react";
import { useId, useRef, useState } from "react";
import { BusyLabel, primaryButtonClass } from "@/components/form-buttons";
import { ErrorLine, inputClass } from "@/components/form-controls";
import { fieldErrorText } from "@/components/input-cards/question-block";
import { COMPANY_APPLICATION_COPY } from "@/lib/company-application-questions";
import { companyErrorMessage } from "@/lib/company-error-message";

const COPY = COMPANY_APPLICATION_COPY.closed.interest;

/**
 * «Gi oss beskjed» on the closed page: the company leaves its name and email, and Navet gets them
 * at bedrift@ifinavet.no to tell it when applications open.
 */
export function InterestForm() {
	const register = useMutation(api.semesterPlanning.interest.mutations.register);
	const [sentTo, setSentTo] = useState<string>();
	const [serverError, setServerError] = useState<string>();
	const honeypot = useRef<HTMLInputElement>(null);
	const id = useId();

	const form = useForm({
		defaultValues: { companyName: "", email: "" } satisfies CompanyInterest,
		validators: { onSubmit: companyInterestSchema },
		onSubmit: async ({ value }) => {
			setServerError(undefined);
			const answers = companyInterestSchema.parse(value);
			try {
				await register({ ...answers, website: honeypot.current?.value || undefined });
				setSentTo(answers.email);
			} catch (error) {
				setServerError(companyErrorMessage(error));
			}
		},
	});
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

	if (sentTo) {
		return (
			<Note className="mt-6" role="status">
				{COPY.sent(sentTo)}
			</Note>
		);
	}

	return (
		<form
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
			className="mt-7 grid gap-3.5 border-border border-t pt-6"
		>
			<div>
				<h2 className="m-0 font-semibold text-[16px] text-foreground">{COPY.title}</h2>
				<p className="m-0 mt-1 text-[14px] text-muted-foreground">{COPY.lede}</p>
			</div>

			{/* Bots fill in every field; people never see this one. */}
			<div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
				<label>
					{COPY.honeypot}
					<input
						ref={honeypot}
						name="navet-hp-field"
						type="text"
						tabIndex={-1}
						autoComplete="off"
					/>
				</label>
			</div>

			<form.Field name="companyName">
				{(field) => {
					const error = fieldErrorText(field);
					return (
						<div>
							<label htmlFor={`${id}-company`} className="mb-1.5 block font-semibold text-[14px]">
								{COPY.companyName}
							</label>
							<input
								id={`${id}-company`}
								className={inputClass(Boolean(error))}
								autoComplete="organization"
								maxLength={MAX_COMPANY_NAME_LENGTH}
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={Boolean(error) || undefined}
								aria-describedby={error ? `${id}-company-error` : undefined}
							/>
							{error && <ErrorLine id={`${id}-company-error`}>{error}</ErrorLine>}
						</div>
					);
				}}
			</form.Field>

			<form.Field name="email">
				{(field) => {
					const error = fieldErrorText(field);
					return (
						<div>
							<label htmlFor={`${id}-email`} className="mb-1.5 block font-semibold text-[14px]">
								{COPY.email}
							</label>
							<input
								id={`${id}-email`}
								type="email"
								inputMode="email"
								autoComplete="email"
								className={inputClass(Boolean(error))}
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={Boolean(error) || undefined}
								aria-describedby={error ? `${id}-email-error` : undefined}
							/>
							{error && <ErrorLine id={`${id}-email-error`}>{error}</ErrorLine>}
						</div>
					);
				}}
			</form.Field>

			{serverError && (
				<Note tone="bad" role="alert">
					{serverError}
				</Note>
			)}

			<button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
				<BusyLabel busy={isSubmitting} idle={COPY.send} busyText={COPY.busy} />
			</button>
		</form>
	);
}
