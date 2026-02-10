import type { AnyFieldApi } from "@tanstack/react-form";
import { useForm } from "@tanstack/react-form";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import z from "zod/v4";

const eventResponseFromSchema = z.object({
	satisfaction: z.int().min(1, "Må velge et alternativ").max(5),
	impression: z.int().min(1, "Må velge et alternativ").max(5),
	expectation: z.int().min(1, "Må velge et alternativ").max(5),
	toughts: z.string().min(1, "Venligst fyll inn").max(1000, "Maks 1000 tegn"),
	improvements: z.string().min(1, "Venligst fyll inn").max(1000, "Maks 1000 tegn"),
	want_to_work: z.enum(["ja", "nei"], { error: "Huk av for et av alternativene" }),
	word_of_mouth: z.array(z.string()).min(1, "Må velge minst et alternativ"),
	other: z.string().max(1000, "Maks 1000 tegn"),
});

export function EventResponseFrom() {
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
			console.log(value);
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

function RatingCard({
	field,
	label,
	lowLabel,
	highLabel,
	required,
}: {
	field: AnyFieldApi;
	label: string;
	lowLabel: string;
	highLabel: string;
	required?: boolean;
}) {
	const ratings = Array.from({ length: 5 }, (_, i) => i + 1);
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Card>
			<FieldGroup className="p-4">
				<Field data-invalid={isInvalid}>
					<FieldLabel htmlFor={field.name} className="pb-8 text-base">
						{label}
						{required && <span className="text-red-500">*</span>}
					</FieldLabel>
					<div className="flex w-full flex-col justify-center gap-10 md:flex-row">
						<p>{lowLabel}</p>
						<RadioGroup
							value={String(field.state.value)}
							onValueChange={(value) => field.handleChange(parseInt(value))}
							className="flex w-fit flex-col gap-8 md:flex-row"
						>
							{ratings.map((rating) => (
								<div className="flex items-center gap-3 md:flex-col" key={rating}>
									<RadioGroupItem
										value={String(rating)}
										id={`${field.name}_${rating}`}
										className="size-6"
									/>
									<Label htmlFor={`${field.name}_${rating}`}>{rating}</Label>
								</div>
							))}
						</RadioGroup>
						<p>{highLabel}</p>
					</div>
					{field.state.meta.errors?.length > 0 && (
						<FieldError>
							{field.state.meta.errors
								.map((e: { message?: string } | string) => (typeof e === "string" ? e : e?.message))
								.join(", ")}
						</FieldError>
					)}
				</Field>
			</FieldGroup>
		</Card>
	);
}

function TextInputCard({
	field,
	label,
	placeholder,
	required,
}: {
	field: AnyFieldApi;
	label: string;
	placeholder: string;
	required?: boolean;
}) {
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Card>
			<FieldGroup className="p-4">
				<Field data-invalid={isInvalid}>
					<FieldLabel htmlFor={field.name} className="pb-4 text-base">
						{label}
						{required && <span className="text-red-500">*</span>}
					</FieldLabel>
					<Input
						id={field.name}
						name={field.name}
						value={field.state.value}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						aria-invalid={isInvalid}
						placeholder={placeholder}
					/>
					{field.state.meta.errors?.length > 0 && (
						<FieldError>
							{field.state.meta.errors
								.map((e: { message?: string } | string) => (typeof e === "string" ? e : e?.message))
								.join(", ")}
						</FieldError>
					)}
				</Field>
			</FieldGroup>
		</Card>
	);
}

function BooleanCard({
	field,
	label,
	required,
}: {
	field: AnyFieldApi;
	label: string;
	required?: boolean;
}) {
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Card>
			<FieldGroup className="p-4">
				<Field data-invalid={isInvalid}>
					<FieldLabel htmlFor={field.name} className="pb-4 text-base">
						{label}
						{required && <span className="text-red-500">*</span>}
					</FieldLabel>
					<div className="">
						<RadioGroup
							value={field.state.value}
							onValueChange={(value) => field.handleChange(value)}
							className="w-fit space-y-4"
						>
							<div className="flex items-center gap-3">
								<RadioGroupItem value="ja" id={`${field.name}_ja`} className="size-6" />
								<Label htmlFor={`${field.name}_ja`}>Ja</Label>
							</div>
							<div className="flex items-center gap-3">
								<RadioGroupItem value="nei" id={`${field.name}_nei`} className="size-6" />
								<Label htmlFor={`${field.name}_nei`}>Nei</Label>
							</div>
						</RadioGroup>
					</div>
					{field.state.meta.errors?.length > 0 && (
						<FieldError>
							{field.state.meta.errors
								.map((e: { message?: string } | string) => (typeof e === "string" ? e : e?.message))
								.join(", ")}
						</FieldError>
					)}
				</Field>
			</FieldGroup>
		</Card>
	);
}

function MultipleOptionsCard({
	field,
	label,
	options,
	required,
}: {
	field: AnyFieldApi;
	label: string;
	options: string[];
	required?: boolean;
}) {
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Card>
			<FieldGroup className="p-4">
				<Field data-invalid={isInvalid}>
					<FieldLabel htmlFor={field.name} className="pb-4 text-base">
						{label}
						{required && <span className="text-red-500">*</span>}
					</FieldLabel>

					{options.map((option) => (
						<Field key={option} orientation="horizontal" data-invalid={isInvalid}>
							<Checkbox
								id={option}
								name={option}
								aria-invalid={isInvalid}
								checked={field.state.value.includes(option)}
								className="size-6"
								onCheckedChange={(checked) => {
									if (checked) {
										field.pushValue(option);
									} else {
										const index = field.state.value.indexOf(option);
										if (index > -1) {
											field.removeValue(index);
										}
									}
								}}
							/>
							<FieldLabel htmlFor={option} className="font-normal">
								{option}
							</FieldLabel>
						</Field>
					))}

					{field.state.meta.errors?.length > 0 && (
						<FieldError>
							{field.state.meta.errors
								.map((e: { message?: string } | string) => (typeof e === "string" ? e : e?.message))
								.join(", ")}
						</FieldError>
					)}
				</Field>
			</FieldGroup>
		</Card>
	);
}
