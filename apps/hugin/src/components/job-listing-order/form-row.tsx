import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field";
import type { ReactNode } from "react";
import { errorText } from "@/components/input-cards/question-block";

export function FormRow({
	label,
	htmlFor,
	errors,
	hint,
	children,
}: Readonly<{
	label: string;
	htmlFor?: string;
	errors?: readonly unknown[];
	hint?: ReactNode;
	children: ReactNode;
}>) {
	const error = errors ? errorText(errors) : undefined;
	return (
		<Field data-invalid={error !== undefined}>
			<FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
			{children}
			{hint && <FieldDescription>{hint}</FieldDescription>}
			{error && <FieldError>{error}</FieldError>}
		</Field>
	);
}
