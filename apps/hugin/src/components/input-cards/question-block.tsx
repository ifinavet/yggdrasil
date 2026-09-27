import type { AnyFieldApi } from "@tanstack/react-form";
import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";
import { ERROR_TEXT, ErrorLine } from "../form-controls";

/** The validation messages in a TanStack error list, joined, if there are any. */
export function errorText(errors: readonly unknown[]): string | undefined {
	const messages = errors
		.map((error) =>
			typeof error === "string" ? error : (error as { message?: string } | undefined)?.message,
		)
		.filter(Boolean);
	return messages.length > 0 ? messages.join(", ") : undefined;
}

/** The validation messages on a field, if the field has any. */
export function fieldErrorText(field: AnyFieldApi): string | undefined {
	return errorText(field.state.meta.errors ?? []);
}

/** The labelled prompt, hint and error element ids for one question. */
export function questionIds(name: string) {
	return { promptId: `${name}-prompt`, hintId: `${name}-hint`, errorId: `${name}-error` };
}

/** `aria-describedby` for a question's control: its hint, and its error while there is one. */
export function questionDescribedBy(
	name: string,
	{ hint = false, invalid = false }: { hint?: boolean; invalid?: boolean },
): string | undefined {
	const { hintId, errorId } = questionIds(name);
	return cn(hint && hintId, invalid && errorId) || undefined;
}

export function isFieldInvalid(field: AnyFieldApi): boolean {
	return field.state.meta.isTouched && !field.state.meta.isValid;
}

/**
 * One question on the sheet: its number, label, an optional hint, the control, and the error
 * line. With `labelFor`, the prompt is the control's <label>. Questions are held apart by space
 * rather than a rule, so the spacing carries the rhythm; `className` sets that space.
 */
export function QuestionBlock({
	name,
	number,
	label,
	invalid,
	error,
	hint,
	labelFor,
	optional,
	className,
	children,
}: Readonly<{
	name: string;
	number: number;
	label: string;
	invalid: boolean;
	error?: string;
	hint?: ReactNode;
	labelFor?: string;
	/** The «Valgfritt» tag shown after the label of a question that can be left empty. */
	optional?: string;
	className?: string;
	children: ReactNode;
}>) {
	const { promptId, hintId, errorId } = questionIds(name);
	const Prompt = labelFor ? "label" : "span";

	return (
		<div
			data-question={name}
			data-invalid={invalid}
			className={cn("mt-[22px] scroll-mt-[56px] pt-[22px] first:mt-0 first:pt-2", className)}
		>
			<Prompt
				id={promptId}
				htmlFor={labelFor}
				className={cn(
					"mb-3 block font-semibold text-[15px] leading-[1.35]",
					invalid ? ERROR_TEXT : "text-foreground",
				)}
			>
				{number}. {label}
				{optional && (
					<span className="ml-1.5 font-normal text-[13px] text-muted-foreground">{optional}</span>
				)}
			</Prompt>
			{hint && (
				<p id={hintId} className="m-0 -mt-1.5 mb-3 text-[13px] text-muted-foreground leading-[1.4]">
					{hint}
				</p>
			)}
			{children}
			{error && <ErrorLine id={errorId}>{error}</ErrorLine>}
		</div>
	);
}
