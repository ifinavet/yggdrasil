"use client";
import { useForm } from "@tanstack/react-form";
import {
	AGE_CHOICES,
	ANSWER_CHOICES,
	PLANNING_FIELDS,
	PLANNING_QUESTIONS,
	type PlanningAnswers,
	planningFormSchema,
	VENUE_CHOICES,
} from "@workspace/shared/events/planning";
import {
	EVENT_TYPE_LABELS,
	type EventType,
	FOOD_PURCHASER_LABELS,
} from "@workspace/shared/semester/labels";
import { convexErrorMessage } from "@workspace/shared/utils";
import { useId, useState, type ReactNode } from "react";
import { AddressInput } from "./address-input";
import type { AddressSearch } from "../hooks/use-address-suggestions";
import { Button } from "./button";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";
import { Input } from "./input";
import { RichTextEditor } from "./rich-text-editor";
import { Textarea } from "./textarea";

type ChoiceKey =
	| "venue"
	| "foodAndDrinks"
	| "foodPurchasedBy"
	| "alcohol"
	| "ageRestriction"
	| "stand";
const selectClass =
	"h-11 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function EventPlanningForm({
	initial,
	searchAddresses,
	capacityLimit,
	eventType,
	onSubmit,
	submitLabel = "Send inn opplysninger",
	before,
	after,
}: Readonly<{
	initial: PlanningAnswers;
	searchAddresses: AddressSearch;
	capacityLimit: number;
	eventType?: EventType;
	onSubmit: (answers: PlanningAnswers) => Promise<unknown>;
	submitLabel?: string;
	before?: ReactNode;
	after?: ReactNode;
}>) {
	const prefix = useId();
	const [locationInputId, setLocationInputId] = useState<string>();
	const [error, setError] = useState("");
	const defaultValues: PlanningAnswers = {
		...initial,
		requestedEventType: initial.requestedEventType ?? eventType,
	};
	const form = useForm({
		defaultValues,
		validators: { onSubmit: planningFormSchema(capacityLimit) },
		onSubmit: async ({ value }) => {
			setError("");
			try {
				await onSubmit(value);
			} catch (e) {
				setError(
					convexErrorMessage(
						e,
						"Kunne ikke lagre. Opplysningene er bevart i skjemaet. Prøv igjen.",
					),
				);
			}
		},
	});
	function text(name: keyof typeof PLANNING_FIELDS) {
		const copy = PLANNING_FIELDS[name];
		return (
			<form.Field key={name} name={name}>
				{(field) => (
					<Field>
						<FieldLabel htmlFor={`${prefix}-${name}`} className="text-base">
							{copy.label}
						</FieldLabel>
						{copy.hint && (
							<FieldDescription id={`${prefix}-${name}-hint`}>{copy.hint}</FieldDescription>
						)}
						{name === "description" ? (
							<RichTextEditor
								id={`${prefix}-${name}`}
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								invalid={field.state.meta.errors.length > 0}
							/>
						) : name === "title" ? (
							<Input
								id={`${prefix}-${name}`}
								aria-describedby={copy.hint ? `${prefix}-${name}-hint` : undefined}
								value={field.state.value}
								maxLength={copy.max}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
							/>
						) : (
							<Textarea
								id={`${prefix}-${name}`}
								aria-describedby={copy.hint ? `${prefix}-${name}-hint` : undefined}
								value={field.state.value}
								maxLength={copy.max}
								rows={name === "teaser" ? 3 : 4}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
							/>
						)}
						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>
		);
	}
	function choice(name: ChoiceKey, label: string, options: Record<string, string>, hint?: string) {
		return (
			<form.Field name={name}>
				{(field) => (
					<Field>
						<FieldLabel htmlFor={`${prefix}-${name}`} className="text-base">
							{label}
						</FieldLabel>
						{hint && <FieldDescription id={`${prefix}-${name}-hint`}>{hint}</FieldDescription>}
						<select
							id={`${prefix}-${name}`}
							className={selectClass}
							aria-describedby={hint ? `${prefix}-${name}-hint` : undefined}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => {
								field.handleChange(e.target.value as PlanningAnswers[ChoiceKey]);
								if (
									(name === "venue" && e.target.value === "escape") ||
									(name === "alcohol" && e.target.value === "yes")
								)
									form.setFieldValue("ageRestriction", "18");
							}}
						>
							{Object.entries(options).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>
		);
	}
	return (
		<form
			className="space-y-10 text-left"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				void form.handleSubmit();
			}}
		>
			{before}
			<form.Field name="requestedEventType">
				{(field) => (
					<Field>
						<FieldLabel htmlFor={`${prefix}-event-type`} className="text-base">
							{eventType
								? `Dere har søkt om ${EVENT_TYPE_LABELS[eventType].toLowerCase()}, stemmer det eller ønsker dere noe annet?`
								: "Hvilken type arrangement ønsker dere?"}
						</FieldLabel>
						<select
							id={`${prefix}-event-type`}
							className={selectClass}
							value={field.state.value ?? ""}
							onBlur={field.handleBlur}
							onChange={(e) =>
								field.handleChange(e.target.value ? (e.target.value as EventType) : undefined)
							}
						>
							<option value="">Ikke avklart</option>
							{Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
						<FieldDescription>Endringer i arrangementstype avklares med Navet.</FieldDescription>
						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>
			<section className="space-y-6 border-t pt-7">
				{choice(
					"venue",
					PLANNING_QUESTIONS.venue.label,
					VENUE_CHOICES,
					PLANNING_QUESTIONS.venue.hint,
				)}
				<form.Field name="location">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={locationInputId} className="text-base">
								Adresse
							</FieldLabel>
							<AddressInput
								onInputId={setLocationInputId}
								label="Adresse"
								value={field.state.value}
								invalid={field.state.meta.errors.length > 0}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								searchAddresses={searchAddresses}
								pinnedSuggestions={["IFI"]}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>
			</section>
			<form.Field name="capacity">
				{(field) => (
					<Field>
						<FieldLabel htmlFor={`${prefix}-capacity`} className="text-base">
							{PLANNING_QUESTIONS.capacity.label}
						</FieldLabel>
						<FieldDescription id={`${prefix}-capacity-hint`}>
							{PLANNING_QUESTIONS.capacity.hint}
						</FieldDescription>
						<Input
							aria-describedby={`${prefix}-capacity-hint`}
							id={`${prefix}-capacity`}
							type="number"
							min={1}
							max={capacityLimit}
							step={1}
							value={Number.isNaN(field.state.value) ? "" : field.state.value}
							onChange={(e) => field.handleChange(e.target.valueAsNumber)}
							onBlur={field.handleBlur}
						/>

						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>
			<form.Field name="startTime">
				{(field) => (
					<Field>
						<FieldLabel htmlFor={`${prefix}-time`} className="text-base">
							{PLANNING_QUESTIONS.startTime.label}
						</FieldLabel>
						<FieldDescription id={`${prefix}-startTime-hint`}>
							{PLANNING_QUESTIONS.startTime.hint}
						</FieldDescription>
						<Input
							aria-describedby={`${prefix}-startTime-hint`}
							id={`${prefix}-time`}
							type="time"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
						/>

						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.values}>
				{(values) => (
					<>
						<section className="space-y-6 border-t pt-7">
							{choice(
								"foodAndDrinks",
								PLANNING_QUESTIONS.foodAndDrinks.label,
								ANSWER_CHOICES,
								PLANNING_QUESTIONS.foodAndDrinks.hint,
							)}
							{values.foodAndDrinks !== "no" && (
								<>
									{choice("foodPurchasedBy", "Hvem ordner serveringen?", FOOD_PURCHASER_LABELS)}
									{text("food")}
								</>
							)}
							{choice("alcohol", "Skal det serveres alkohol?", ANSWER_CHOICES)}
						</section>
						<section className="space-y-6 border-t pt-7">
							{choice(
								"ageRestriction",
								PLANNING_QUESTIONS.ageRestriction.label,
								values.venue === "escape" || values.alcohol === "yes"
									? { "18": AGE_CHOICES["18"] }
									: AGE_CHOICES,
								PLANNING_QUESTIONS.ageRestriction.hint,
							)}
						</section>
						<section
							className="space-y-6 border-t pt-7"
							aria-labelledby={`${prefix}-content-heading`}
						>
							<div className="space-y-3">
								<h2 id={`${prefix}-content-heading`} className="text-base font-medium">
									{PLANNING_QUESTIONS.description.label}
								</h2>
								<FieldDescription>{PLANNING_QUESTIONS.description.hint}</FieldDescription>
							</div>
							{text("title")}
							{text("teaser")}
							{text("description")}
						</section>
						<section className="space-y-6 border-t pt-7">
							{choice(
								"stand",
								PLANNING_QUESTIONS.stand.label,
								ANSWER_CHOICES,
								PLANNING_QUESTIONS.stand.hint,
							)}
							{values.stand === "yes" && text("standDetails")}
						</section>
					</>
				)}
			</form.Subscribe>
			<form.Field name="language">
				{(field) => (
					<Field>
						<FieldLabel htmlFor={`${prefix}-language`} className="text-base">
							Hvilket språk skal arrangementet holdes på?
						</FieldLabel>
						<Input
							id={`${prefix}-language`}
							list={`${prefix}-languages`}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							placeholder="Norsk, engelsk eller et annet språk"
							maxLength={100}
						/>
						<datalist id={`${prefix}-languages`}>
							<option value="Norsk" />
							<option value="Engelsk" />
						</datalist>
						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>
			{text("notes")}

			{after}
			<div className="space-y-3 border-t pt-6">
				{error && (
					<p role="alert" className="text-destructive">
						{error}
					</p>
				)}
				<form.Subscribe selector={(state) => [state.isSubmitting, state.isValid] as const}>
					{([pending, valid]) => (
						<>
							{!valid && (
								<p role="alert" className="text-sm text-destructive">
									Kontroller de markerte feltene før du fortsetter.
								</p>
							)}
							<Button
								type="submit"
								size="lg"
								disabled={pending}
								className="min-h-12 w-full sm:w-auto"
							>
								{pending ? "Lagrer …" : submitLabel}
							</Button>
						</>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}
