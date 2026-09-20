import type { AnyFieldApi } from "@tanstack/react-form";
import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

/** The first validation message on a field, if the field has one. */
export function fieldErrorText(field: AnyFieldApi): string | undefined {
	if (!field.state.meta.errors?.length) return undefined;

	return field.state.meta.errors
		.map((error: { message?: string } | string) =>
			typeof error === "string" ? error : error?.message,
		)
		.filter(Boolean)
		.join(", ");
}

export function isFieldInvalid(field: AnyFieldApi): boolean {
	return field.state.meta.isTouched && !field.state.meta.isValid;
}

/**
 * One question on the sheet: label, optional hint, the control, and the error
 * line. Questions are separated by a hairline instead of a card each, so the
 * block owns its own divider.
 */
export function QuestionBlock({
	name,
	label,
	hint,
	hintId,
	invalid,
	error,
	children,
}: Readonly<{
	name: string;
	label: string;
	hint?: string;
	hintId?: string;
	invalid: boolean;
	error?: string;
	children: ReactNode;
}>) {
	return (
		<div
			data-question={name}
			data-invalid={invalid}
			className="mt-[22px] scroll-mt-[130px] border-border border-t pt-[22px] first:mt-0 first:border-t-0 first:pt-2"
		>
			<span
				className={cn(
					"mb-3 block font-semibold text-[15px] leading-[1.35]",
					invalid ? "text-destructive" : "text-foreground",
				)}
			>
				{label}
			</span>
			{hint && (
				<span id={hintId} className="-mt-1.5 mb-3 block text-[13px] text-muted-foreground">
					{hint}
				</span>
			)}
			{children}
			{error && <p className="mt-2.5 font-medium text-[13px] text-destructive">{error}</p>}
		</div>
	);
}
