import type { AnyFieldApi } from "@tanstack/react-form";
import { Card } from "@workspace/ui/components/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

export function BooleanCard({
	field,
	label,
	required,
	readonly,
}: Readonly<{
	field: AnyFieldApi;
	label: string;
	required?: boolean;
	readonly?: boolean;
}>) {
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
							disabled={readonly}
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
