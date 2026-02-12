"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
	BooleanCard,
	MultipleOptionsCard,
	RatingCard,
	TextInputCard,
} from "@/components/input-cards";
import { eventResponseFromSchema } from "@/lib/schema/event-feedback-schema";

export function EventResponseFrom({
	event,
	userId,
}: Readonly<{ event: FunctionReturnType<typeof api.events.getEvent>; userId: string }>) {
	const formResponseMutation = useMutation(api.forms.submitFormResponse);
	const router = useRouter();
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
			try {
				formResponseMutation({
					formId: event.formId!,
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

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<form.Field name="satisfaction">
				{(field) => (
					<RatingCard
						field={field}
						label="Hvordan syntes du arrangementet var?"
						lowLabel="Veldig Dårlig"
						highLabel="Veldig Bra"
						required
					/>
				)}
			</form.Field>
			<form.Field name="impression">
				{(field) => (
					<RatingCard
						field={field}
						label="Hvilket inntrykk fikk du av bedriften?"
						lowLabel="Veldig Dårlig"
						highLabel="Veldig Bra"
						required
					/>
				)}
			</form.Field>
			<form.Field name="expectation">
				{(field) => (
					<RatingCard
						field={field}
						label="Var arrangementet som forventet?"
						lowLabel="Dårligere enn forventet"
						highLabel="Bedre enn forventet"
						required
					/>
				)}
			</form.Field>
			<form.Field name="toughts">
				{(field) => (
					<TextInputCard
						field={field}
						label="Hva syntes du om arrangementet og bedriften?"
						placeholder="Svaret ditt"
						required
					/>
				)}
			</form.Field>
			<form.Field name="improvements">
				{(field) => (
					<TextInputCard
						field={field}
						label="Hva kunne gjort arrangementet bedre?"
						placeholder="Svaret ditt"
						required
					/>
				)}
			</form.Field>
			<form.Field name="want_to_work">
				{(field) => (
					<BooleanCard
						field={field}
						label="Kan du tenkte deg å jobbe for denne bedriften?"
						required
					/>
				)}
			</form.Field>
			<form.Field name="word_of_mouth">
				{(field) => (
					<MultipleOptionsCard
						field={field}
						label="Hvordan fikk du vite om arrangementet?"
						options={[
							"Ifinavet.no",
							"Stand utenfor Simula",
							"Facebook (IFI-studenter)",
							"Facebook (Arrangementside)",
							"Instagram",
							"Venner",
						]}
						required
					/>
				)}
			</form.Field>
			<form.Field name="other">
				{(field) => <TextInputCard field={field} label="Annet?" placeholder="Svaret ditt" />}
			</form.Field>

			<Button type="submit">Send inn svar</Button>
		</form>
	);
}
