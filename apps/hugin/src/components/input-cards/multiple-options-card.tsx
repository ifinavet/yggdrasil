import type { AnyFieldApi } from "@tanstack/react-form";
import { Card } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";

export function MultipleOptionsCard({
	field,
	label,
	options,
	required,
	readonly,
}: {
	field: AnyFieldApi;
	label: string;
	options: string[];
	required?: boolean;
	readonly?: boolean;
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
								disabled={readonly}
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
