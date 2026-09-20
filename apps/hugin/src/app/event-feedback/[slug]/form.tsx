"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	BooleanCard,
	MultipleOptionsCard,
	RatingCard,
	TextInputCard,
} from "@/components/input-cards";
import {
	missingRequiredFields,
	optionsQuestion,
	ratingQuestions,
	requiredQuestionCount,
	textQuestions,
	yesNoQuestion,
} from "@/lib/event-feedback-questions";
import { eventResponseFromSchema } from "@/lib/schema/event-feedback-schema";

const CONTROL_SELECTOR = 'button[role="radio"], button[role="checkbox"], textarea, input';

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

		if (missingNow.length === 0) return;

		const block = formElement.current?.querySelector<HTMLElement>(
			`[data-question="${missingNow[0]}"]`,
		);
		block?.scrollIntoView({ block: "center", behavior: "smooth" });

		window.setTimeout(() => {
			block?.querySelector<HTMLElement>(CONTROL_SELECTOR)?.focus({ preventScroll: true });
		}, 400);
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
				<div className="sticky top-[104px] z-4 flex items-center gap-2.5 bg-background py-3">
					<span className="whitespace-nowrap font-semibold text-[12.5px] text-muted-foreground tabular-nums">
						{answered} av {requiredQuestionCount} besvart
					</span>
					<span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
						<span
							className="block h-full rounded-full bg-primary transition-[width] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
							style={{ width: `${(answered / requiredQuestionCount) * 100}%` }}
						/>
					</span>
				</div>

				{showMissingSummary && missing.length > 0 && (
					<div
						role="alert"
						className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-[color-mix(in_oklab,var(--destructive)_42%,var(--border))] bg-[color-mix(in_oklab,var(--destructive)_7%,var(--card))] px-[14px] py-[13px] text-[13.5px] text-[color-mix(in_oklab,var(--destructive)_82%,var(--foreground))]"
					>
						<CircleAlert className="mt-0.5 size-4 flex-none" />
						<span>
							Vi mangler svar på {missing.length} spørsmål. Det første står rett under, resten er
							merket med rødt.
						</span>
					</div>
				)}

				{/* Bottom clearance must exceed the sticky dock, or the last question
				    can never scroll clear of it and taps land on submit. */}
				<div className="pb-[110px]">
					{ratingQuestions.map((question) => (
						<form.Field key={question.id} name={question.id}>
							{(field) => (
								<RatingCard
									field={field}
									label={question.label}
									low={question.low}
									high={question.high}
								/>
							)}
						</form.Field>
					))}

					{textQuestions.map((question) => (
						<form.Field key={question.id} name={question.id}>
							{(field) => (
								<TextInputCard
									field={field}
									label={question.label}
									placeholder={question.placeholder}
									required={!question.optional}
								/>
							)}
						</form.Field>
					))}

					<form.Field name={yesNoQuestion.id}>
						{(field) => <BooleanCard field={field} label={yesNoQuestion.label} />}
					</form.Field>

					<form.Field name={optionsQuestion.id}>
						{(field) => (
							<MultipleOptionsCard
								field={field}
								label={optionsQuestion.label}
								options={optionsQuestion.options}
							/>
						)}
					</form.Field>
				</div>
			</div>

			<div className="sticky bottom-0 z-6 border-border border-t bg-[color-mix(in_oklab,var(--background)_92%,transparent)] py-3 backdrop-blur-[6px]">
				<div className="flex items-center gap-3">
					<span
						role="status"
						aria-live="polite"
						className={cn(
							"whitespace-nowrap font-semibold text-[12.5px] tabular-nums",
							showMissingInDock ? "text-destructive" : "text-muted-foreground",
						)}
					>
						{showMissingInDock
							? `${missing.length} felt mangler svar`
							: `${answered} / ${requiredQuestionCount}`}
					</span>
					<button
						type="submit"
						disabled={isSubmitting}
						className="grid h-[52px] flex-1 place-items-center rounded-[13px] bg-primary font-semibold text-[15.5px] text-primary-foreground shadow-[0_12px_20px_-14px_rgba(31,40,71,0.95)] transition-transform duration-100 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55"
					>
						{isSubmitting ? (
							<span className="flex items-center">
								<span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-[color-mix(in_oklab,var(--primary-foreground)_40%,transparent)] border-t-primary-foreground align-[-3px]" />{" "}
								Sender …
							</span>
						) : (
							"Send inn svar"
						)}
					</button>
				</div>
			</div>
		</form>
	);
}
