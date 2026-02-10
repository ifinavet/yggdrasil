import type { AnyFieldApi } from "@tanstack/react-form";
import { Card } from "@workspace/ui/components/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function TextInputCard({
	field,
	label,
	placeholder,
	required,
	readonly,
}: {
	field: AnyFieldApi;
	label: string;
	placeholder: string;
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
					<Input
						id={field.name}
						name={field.name}
						value={field.state.value}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						aria-invalid={isInvalid}
						placeholder={placeholder}
						readOnly={readonly}
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
