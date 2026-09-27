import { cn } from "@workspace/ui/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { inputClass, textareaClass } from "@/components/form-controls";
import { QuestionBlock, questionDescribedBy } from "@/components/input-cards/question-block";
import { isOptionalQuestion, type QuestionKey, questionNumber } from "@/lib/company-application";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";

/** A section heading in the application form: «Bedriften», «Arrangementet» and so on. */
export function FormSection({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<h2 className="m-0 mt-[26px] font-bold text-[17px] text-primary leading-tight tracking-[-0.01em] dark:text-primary-foreground">
			{children}
		</h2>
	);
}

/** One numbered question of the application form, with its message after a failed send. */
export function ApplicationQuestion({
	name,
	label,
	error,
	hint,
	labelFor,
	children,
}: Readonly<{
	name: QuestionKey;
	label: string;
	error?: string;
	hint?: ReactNode;
	labelFor?: string;
	children: ReactNode;
}>) {
	return (
		<QuestionBlock
			name={name}
			number={questionNumber(name)}
			label={label}
			invalid={Boolean(error)}
			error={error}
			hint={hint}
			labelFor={labelFor}
			optional={isOptionalQuestion(name) ? COPY.optional : undefined}
			className="pt-0"
		>
			{children}
		</QuestionBlock>
	);
}

/** `aria-invalid` and `aria-describedby` for a control in the question `name`. */
export function answerAria(name: QuestionKey, error: string | undefined, { hint = false } = {}) {
	return {
		"aria-invalid": error ? true : undefined,
		"aria-describedby": questionDescribedBy(name, { hint, invalid: Boolean(error) }),
	};
}

/** A one-line text answer. */
export function TextAnswer({
	invalid,
	onValueChange,
	className,
	...props
}: Readonly<
	Omit<ComponentProps<"input">, "onChange"> & {
		invalid: boolean;
		onValueChange: (value: string) => void;
	}
>) {
	return (
		<input
			type="text"
			{...props}
			onChange={(event) => onValueChange(event.target.value)}
			className={cn(inputClass(invalid), className)}
		/>
	);
}

/** A text answer over several lines. */
export function LongTextAnswer({
	invalid,
	onValueChange,
	className,
	...props
}: Readonly<
	Omit<ComponentProps<"textarea">, "onChange"> & {
		invalid: boolean;
		onValueChange: (value: string) => void;
	}
>) {
	return (
		<textarea
			{...props}
			onChange={(event) => onValueChange(event.target.value)}
			className={cn(textareaClass(invalid), className)}
		/>
	);
}

/** A small visible label above one of several fields in a question. */
export function FieldLabel({
	htmlFor,
	label,
	children,
}: Readonly<{ htmlFor: string; label: string; children: ReactNode }>) {
	return (
		<div className="grid gap-1">
			<label htmlFor={htmlFor} className="font-semibold text-[12.5px] text-muted-foreground">
				{label}
			</label>
			{children}
		</div>
	);
}
