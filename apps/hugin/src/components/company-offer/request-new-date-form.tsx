"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { MAX_REQUESTED_DATES } from "@workspace/shared/semester/limits";
import { Note } from "@workspace/ui/components/note";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { useState } from "react";
import { CheckMark, ERROR_TEXT, ErrorLine } from "@/components/form-controls";
import { fieldErrorText } from "@/components/input-cards/question-block";
import { SubmitDock } from "@/components/submit-dock";
import { companyErrorMessage } from "@/lib/company-error-message";
import { COMPANY_OFFER_COPY } from "@/lib/company-offer-copy";
import { pickableDayLabel } from "@/lib/company-offer-format";
import { requestNewDateSchema } from "@/lib/schema/company-offer-schema";
import { CommentField, ContactLink, StepHeader } from "./offer-parts";

const COPY = COMPANY_OFFER_COPY.newDate;
const DATES_ERROR_ID = "requested-dates-error";

/**
 * Asks for other dates instead of the offered one. The company picks among the semester's open
 * days; the page never shows which days other companies have.
 */
export function RequestNewDateForm({
	token,
	openDates,
	onBack,
}: Readonly<{ token: string; openDates: string[]; onBack: () => void }>) {
	const requestNewDate = useMutation(api.semesterPlanning.offers.mutations.requestNewDate);
	const [serverError, setServerError] = useState<string>();

	const form = useForm({
		defaultValues: { dates: [] as string[], comment: "" },
		validators: { onSubmit: requestNewDateSchema },
		onSubmit: async ({ value }) => {
			setServerError(undefined);
			const comment = value.comment.trim();
			try {
				// The live query then moves the page to the requested state.
				await requestNewDate({
					token,
					dates: value.dates,
					...(comment ? { comment } : {}),
				});
			} catch (error) {
				setServerError(companyErrorMessage(error));
			}
		},
	});

	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

	return (
		<form
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<div className="pb-6">
				<StepHeader title={COPY.title} onBack={onBack}>
					{COPY.lede}
				</StepHeader>
				<Note className="mt-4">{COPY.pickSeveral}</Note>

				<form.Field name="dates">
					{(field) => {
						const selected = field.state.value;
						const error = fieldErrorText(field);
						const atLimit = selected.length >= MAX_REQUESTED_DATES;

						return (
							<fieldset
								className="m-0 mt-[22px] border-0 p-0"
								aria-describedby={error ? DATES_ERROR_ID : undefined}
							>
								<legend
									className={cn(
										"mb-2.5 p-0 font-semibold text-[15px] leading-[1.35]",
										error ? ERROR_TEXT : "text-foreground",
									)}
								>
									{COPY.datesLabel}
								</legend>
								{atLimit && (
									<p className="m-0 -mt-1 mb-2.5 text-[13px] text-muted-foreground leading-[1.4]">
										{COPY.atLimit(MAX_REQUESTED_DATES)}
									</p>
								)}

								{openDates.length === 0 ? (
									<Note>
										{COPY.noDates} <ContactLink />
										{COPY.noDatesEnd}
									</Note>
								) : (
									<div className="grid gap-2 tabular-nums">
										{openDates.map((date) => {
											const checked = selected.includes(date);
											const id = `date-${date}`;

											return (
												<div key={date} className="relative">
													<input
														type="checkbox"
														id={id}
														className="peer sr-only"
														checked={checked}
														disabled={!checked && atLimit}
														aria-invalid={Boolean(error) || undefined}
														onBlur={field.handleBlur}
														onChange={() =>
															field.handleChange(
																checked
																	? selected.filter((value) => value !== date)
																	: [...selected, date].sort((a, b) => a.localeCompare(b)),
															)
														}
													/>
													<label
														htmlFor={id}
														className={cn(
															"flex min-h-[54px] cursor-pointer items-center gap-2.5 rounded-xl border px-[14px] py-2.5 font-semibold text-[15px] leading-[1.3] transition-[background-color,border-color,color] duration-150 peer-focus-visible:outline-3 peer-focus-visible:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)] peer-focus-visible:outline-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-55",
															checked
																? "border-primary bg-primary text-primary-foreground"
																: "border-input bg-card",
														)}
													>
														<CheckMark checked={checked} inverted className="rounded-[6px]" />
														{pickableDayLabel(date)}
													</label>
												</div>
											);
										})}
									</div>
								)}
								{error && <ErrorLine id={DATES_ERROR_ID}>{error}</ErrorLine>}
							</fieldset>
						);
					}}
				</form.Field>

				<form.Field name="comment">
					{(field) => <CommentField field={field} id="offer-comment" label={COPY.commentLabel} />}
				</form.Field>

				{serverError && (
					<Note tone="bad" role="alert" className="mt-4">
						{serverError}
					</Note>
				)}
			</div>

			<SubmitDock
				bleed
				label={COPY.send}
				busyLabel={COMPANY_OFFER_COPY.busy}
				isSubmitting={isSubmitting}
				disabled={openDates.length === 0}
			/>
		</form>
	);
}
