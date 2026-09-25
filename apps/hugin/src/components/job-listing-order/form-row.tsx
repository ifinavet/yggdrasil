import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field";
import type { ReactNode } from "react";
import { firstError } from "@/lib/job-listing-order/errors";

export function FormRow({
	label,
	htmlFor,
	errors,
	hint,
	children,
}: Readonly<{
	label: string;
	htmlFor: string;
	errors?: readonly unknown[];
	hint?: ReactNode;
	children: ReactNode;
}>) {
	const error = errors ? firstError(errors) : undefined;
	return (
		<Field data-invalid={error !== undefined}>
			<FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
			{children}
			{hint && <FieldDescription>{hint}</FieldDescription>}
			{error && <FieldError>{error}</FieldError>}
		</Field>
	);
}

export function ErrorLine({ errors }: Readonly<{ errors: readonly unknown[] }>) {
	const error = firstError(errors);
	return error ? <FieldError>{error}</FieldError> : null;
}
