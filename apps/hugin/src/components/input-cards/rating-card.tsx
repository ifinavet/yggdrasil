import type { AnyFieldApi } from "@tanstack/react-form";
import { Card } from "@workspace/ui/components/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function RatingCard({
	field,
	label,
	lowLabel,
	highLabel,
	required,
	readonly,
}: Readonly<{
	field: AnyFieldApi;
	label: string;
	lowLabel: string;
	highLabel: string;
	required?: boolean;
	readonly?: boolean;
}>) {
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
							onValueChange={(value) => field.handleChange(Number.parseInt(value))}
							className="flex w-fit flex-col gap-8 md:flex-row"
							disabled={readonly}
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
