"use client";

import { useForm } from "@tanstack/react-form";
import {
	BooleanCard,
	MultipleOptionsCard,
	RatingCard,
	TextInputCard,
} from "@/components/input-cards";

export interface ResponseData {
	satisfaction: number;
	impression: number;
	expectation: number;
	toughts: string;
	improvements: string;
	want_to_work: string;
	word_of_mouth: string[];
	other: string;
}

export function ReadonlyEventResponseForm({ data }: Readonly<{ data: ResponseData }>) {
	const form = useForm({
		defaultValues: {
			satisfaction: data.satisfaction,
			impression: data.impression,
			expectation: data.expectation,
			toughts: data.toughts,
			improvements: data.improvements,
			want_to_work: data.want_to_work,
			word_of_mouth: data.word_of_mouth,
			other: data.other,
		},
	});

	return (
		<div className="space-y-4">
			<form.Field name="satisfaction">
				{(field) => (
					<RatingCard
						field={field}
						label="Hvordan syntes du arrangementet var?"
						lowLabel="Veldig Dårlig"
						highLabel="Veldig Bra"
						readonly
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
						readonly
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
						readonly
					/>
				)}
			</form.Field>
			<form.Field name="toughts">
				{(field) => (
					<TextInputCard
						field={field}
						label="Hva syntes du om arrangementet og bedriften?"
						placeholder=""
						readonly
					/>
				)}
			</form.Field>
			<form.Field name="improvements">
				{(field) => (
					<TextInputCard
						field={field}
						label="Hva kunne gjort arrangementet bedre?"
						placeholder=""
						readonly
					/>
				)}
			</form.Field>
			<form.Field name="want_to_work">
				{(field) => (
					<BooleanCard
						field={field}
						label="Kan du tenkte deg å jobbe for denne bedriften?"
						readonly
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
						readonly
					/>
				)}
			</form.Field>
			<form.Field name="other">
				{(field) => <TextInputCard field={field} label="Annet?" placeholder="" readonly />}
			</form.Field>
		</div>
	);
}
