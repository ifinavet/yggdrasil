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

/** The labelled prompt and error element ids for one question. */
export function questionIds(name: string) {
	return { promptId: `${name}-prompt`, errorId: `${name}-error` };
}

export function isFieldInvalid(field: AnyFieldApi): boolean {
	return field.state.meta.isTouched && !field.state.meta.isValid;
}

/**
 * One question on the sheet: its number, label, the control, and the error
 * line. Questions are held apart by space rather than a rule, so the spacing
 * carries the rhythm.
 */
export function QuestionBlock({
	name,
	number,
	label,
	invalid,
	error,
	children,
}: Readonly<{
	name: string;
	number: number;
	label: string;
	invalid: boolean;
	error?: string;
	children: ReactNode;
}>) {
	const { promptId, errorId } = questionIds(name);

	return (
		<div
			data-question={name}
			data-invalid={invalid}
			className="mt-[22px] scroll-mt-[56px] pt-[22px] first:mt-0 first:pt-2"
		>
			<span
				id={promptId}
				className={cn(
					"mb-3 block font-semibold text-[15px] leading-[1.35]",
					invalid ? "text-destructive" : "text-foreground",
				)}
			>
				{number}. {label}
			</span>
			{children}
			{error && (
				<p id={errorId} className="mt-2.5 font-medium text-[13px] text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
