"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { Note } from "@workspace/ui/components/note";
import { useMutation } from "convex/react";
import { useState } from "react";
import { BusyLabel, declineButtonClass, secondaryButtonClass } from "@/components/form-buttons";
import { companyErrorMessage } from "@/lib/company-error-message";
import { COMPANY_OFFER_COPY } from "@/lib/company-offer-copy";
import { dayInSentence, offerSemesterName } from "@/lib/company-offer-format";
import { declineOfferSchema } from "@/lib/schema/company-offer-schema";
import type { KnownOffer } from "./company-offer";
import { CommentField, StepHeader } from "./offer-parts";

const COPY = COMPANY_OFFER_COPY.decline;

/**
 * Confirms that the company says no for this semester. Declining withdraws the application, so
 * the step spells that out before the company answers.
 */
export function DeclineOfferForm({
	token,
	offer,
	onBack,
}: Readonly<{ token: string; offer: KnownOffer; onBack: () => void }>) {
	const decline = useMutation(api.semesterPlanning.offers.mutations.decline);
	const [serverError, setServerError] = useState<string>();
	const semester = offerSemesterName(offer.date, { inSentence: true });

	const form = useForm({
		defaultValues: { comment: "" },
		validators: { onSubmit: declineOfferSchema },
		onSubmit: async ({ value }) => {
			setServerError(undefined);
			const comment = value.comment.trim();
			try {
				// The live query then moves the page to the declined state.
				await decline({ token, ...(comment ? { comment } : {}) });
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
			<StepHeader title={COPY.title} onBack={onBack}>
				{COPY.withdraws(semester)}
				{offer.state === "pending" ? (
					<>
						{COPY.freesDay} <b>{dayInSentence(offer.date)}</b> {COPY.freesDayEnd}
					</>
				) : (
					"."
				)}{" "}
				{COPY.welcomeBack}
			</StepHeader>

			<form.Field name="comment">
				{(field) => <CommentField field={field} id="decline-comment" label={COPY.commentLabel} />}
			</form.Field>

			{serverError && (
				<Note tone="bad" role="alert" className="mt-4">
					{serverError}
				</Note>
			)}

			<div className="mt-5 grid gap-2.5">
				<button type="submit" disabled={isSubmitting} className={declineButtonClass}>
					<BusyLabel busy={isSubmitting} idle={COPY.send} busyText={COMPANY_OFFER_COPY.busy} />
				</button>
				<button
					type="button"
					disabled={isSubmitting}
					onClick={onBack}
					className={secondaryButtonClass}
				>
					{COMPANY_OFFER_COPY.back}
				</button>
			</div>
		</form>
	);
}
