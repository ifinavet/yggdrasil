"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Note } from "@/components/form-controls";
import { FormProgress } from "@/components/form-progress";
import {
	BooleanCard,
	MultipleOptionsCard,
	RatingCard,
	TextInputCard,
} from "@/components/input-cards";
import { SubmitDock } from "@/components/submit-dock";
import { questionOrder, requiredQuestionCount } from "@/lib/event-feedback-questions";
import { focusQuestion } from "@/lib/focus-question";
import { eventResponseFromSchema, missingRequiredFields } from "@/lib/schema/event-feedback-schema";

export function EventResponseForm({
	event,
	userId,
}: Readonly<{ event: FunctionReturnType<typeof api.events.queries.getEvent>; userId: string }>) {
	const formResponseMutation = useMutation(api.forms.mutations.submitFormResponse);
	const router = useRouter();
	const formElement = useRef<HTMLFormElement>(null);
	const [showMissingSummary, setShowMissingSummary] = useState(false);

	const form = useForm({
		defaultValues: {
			satisfaction: 0,
			impression: 0,
			expectation: 0,
			toughts: "",
			improvements: "",
			want_to_work: "",
			word_of_mouth: [] as string[],
			other: "",
		},
		validators: {
			onSubmit: eventResponseFromSchema,
		},
		onSubmit: async ({ value }) => {
			const formId = event.formId;
			if (!formId) {
				toast.error("Dette arrangementet har ingen tilbakemeldingsskjema");
				return;
			}

			try {
				// Await the write: the response page reads it back straight away, and
				// navigating before the mutation is confirmed told a student who had
				// just answered that they had not answered.
				await formResponseMutation({
					formId,
					data: {
						userId,
						eventId: event._id,
						...value,
					},
				});
				toast.success("Takk for din tilbakemelding!");
				router.push(`/event-feedback/${event.slug ?? event._id}/response`);
			} catch (error) {
				console.error(error);
				toast.error("Hmm, det ser ut til at det har skjedd en feil", {
					description: "Skulle feilen vedvare så burde du gi beskjed til webansvarlig",
				});
			}
		},
	});

	const values = useStore(form.store, (state) => state.values);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

	const missing = missingRequiredFields(values);
	const answered = requiredQuestionCount - missing.length;

	const send = async () => {
		const missingNow = missingRequiredFields(form.state.values);
		setShowMissingSummary(missingNow.length > 0);

		await form.handleSubmit();

		const [first] = missingNow;
		if (first) focusQuestion(formElement.current, first);
	};

	const showMissingInDock = showMissingSummary && missing.length > 0;

	return (
		<form
			ref={formElement}
			onSubmit={(event_) => {
				event_.preventDefault();
				void send();
			}}
			className="flex flex-1 flex-col"
			noValidate
		>
			<div className="flex-1">
				<FormProgress answered={answered} total={requiredQuestionCount} />

				{showMissingSummary && missing.length > 0 && (
					<Note tone="bad" role="alert" className="mt-3.5">
						Vi mangler svar på {missing.length} spørsmål. Det første står rett under, resten er
						merket med rødt.
					</Note>
				)}

				{/* Bottom clearance must exceed the sticky dock, or the last question
				    can never scroll clear of it and taps land on submit. */}
				<div className="pb-[110px]">
					{questionOrder.map((entry, index) => {
						const number = index + 1;

						if (entry.kind === "rating") {
							return (
								<form.Field key={entry.question.id} name={entry.question.id}>
									{(field) => (
										<RatingCard
											field={field}
											number={number}
											label={entry.question.label}
											low={entry.question.low}
											high={entry.question.high}
										/>
									)}
								</form.Field>
							);
						}

						if (entry.kind === "text") {
							return (
								<form.Field key={entry.question.id} name={entry.question.id}>
									{(field) => (
										<TextInputCard
											field={field}
											number={number}
											label={entry.question.label}
											placeholder={entry.question.placeholder}
											required={!entry.question.optional}
										/>
									)}
								</form.Field>
							);
						}

						if (entry.kind === "yesNo") {
							return (
								<form.Field key={entry.question.id} name={entry.question.id}>
									{(field) => (
										<BooleanCard field={field} number={number} label={entry.question.label} />
									)}
								</form.Field>
							);
						}

						return (
							<form.Field key={entry.question.id} name={entry.question.id}>
								{(field) => (
									<MultipleOptionsCard
										field={field}
										number={number}
										label={entry.question.label}
										options={entry.question.options}
									/>
								)}
							</form.Field>
						);
					})}
				</div>
			</div>

			<SubmitDock
				label="Send inn svar"
				busyLabel="Sender …"
				isSubmitting={isSubmitting}
				status={
					showMissingInDock
						? `${missing.length} felt mangler svar`
						: `${answered} / ${requiredQuestionCount}`
				}
				statusIsError={showMissingInDock}
			/>
		</form>
	);
}
