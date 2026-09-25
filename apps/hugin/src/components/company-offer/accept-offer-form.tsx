"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { Note } from "@workspace/ui/components/note";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
	BusyLabel,
	primaryButtonClass,
	quietLinkButtonClass,
	secondaryButtonClass,
} from "@/components/form-buttons";
import { CheckboxLine, linkClass } from "@/components/form-controls";
import { fieldErrorText } from "@/components/input-cards/question-block";
import { companyErrorMessage } from "@/lib/company-error-message";
import { COMPANY_OFFER_COPY } from "@/lib/company-offer-copy";
import { offerSemesterName } from "@/lib/company-offer-format";
import { acceptOfferSchema } from "@/lib/schema/company-offer-schema";
import type { KnownOffer } from "./company-offer";
import { OFFER_TITLE_CLASS, OfferDayCard, OfferFacts } from "./offer-parts";

const COPY = COMPANY_OFFER_COPY.offer;

/** The open offer: the facts, the terms box and the three answers. */
export function AcceptOfferForm({
	token,
	offer,
	onAskForNewDate,
	onDecline,
}: Readonly<{
	token: string;
	offer: KnownOffer;
	onAskForNewDate: () => void;
	onDecline: () => void;
}>) {
	const accept = useMutation(api.semesterPlanning.offers.mutations.accept);
	const [serverError, setServerError] = useState<string>();

	const form = useForm({
		defaultValues: { acceptTerms: false },
		validators: { onSubmit: acceptOfferSchema },
		onSubmit: async ({ value }) => {
			setServerError(undefined);
			try {
				// The live query then moves the page to the accepted state.
				await accept({ token, acceptTerms: value.acceptTerms });
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
			<h1 className={`${OFFER_TITLE_CLASS} mt-[22px]`}>{COPY.title(offer.companyName)}</h1>
			<p className="m-0 mt-[5px] text-[13.5px] text-muted-foreground">
				{offerSemesterName(offer.date)}
			</p>

			<OfferDayCard date={offer.date} note={COPY.held} />
			<OfferFacts offer={offer} />

			<form.Field name="acceptTerms">
				{(field) => (
					<div className="mt-[18px]">
						<CheckboxLine
							id="accept-terms"
							checked={field.state.value}
							onChange={(checked) => {
								field.handleChange(checked);
								if (checked) setServerError(undefined);
							}}
							error={fieldErrorText(field)}
							errorId="accept-terms-error"
						>
							<label htmlFor="accept-terms" className="cursor-pointer">
								{offer.termsUrl ? (
									<>
										{COPY.termsLabel}{" "}
										<a href={offer.termsUrl} target="_blank" rel="noreferrer" className={linkClass}>
											{COPY.termsLink}
										</a>{" "}
										{COPY.termsLabelEnd}
									</>
								) : (
									COPY.termsLabelPlain
								)}
							</label>
						</CheckboxLine>
					</div>
				)}
			</form.Field>

			{serverError && (
				<Note tone="bad" role="alert" className="mt-4">
					{serverError}
				</Note>
			)}

			<div className="mt-5 grid gap-2.5">
				<button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
					<BusyLabel busy={isSubmitting} idle={COPY.accept} busyText={COPY.accepting} />
				</button>
				<button
					type="button"
					disabled={isSubmitting}
					onClick={onAskForNewDate}
					className={secondaryButtonClass}
				>
					{COPY.askForNewDate}
				</button>
				<button
					type="button"
					disabled={isSubmitting}
					onClick={onDecline}
					className={quietLinkButtonClass}
				>
					{COPY.decline}
				</button>
			</div>
		</form>
	);
}
