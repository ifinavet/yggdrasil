import type { AnyFieldApi } from "@tanstack/react-form";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { fieldErrorText, isFieldInvalid, QuestionBlock } from "./question-block";

export function TextInputCard({
	field,
	label,
	hint,
	placeholder,
}: Readonly<{
	field: AnyFieldApi;
	label: string;
	hint?: string;
	placeholder: string;
}>) {
	const invalid = isFieldInvalid(field);
	const value = String(field.state.value ?? "");
	const hintId = `${field.name}-hint`;
	const counterId = `${field.name}-counter`;

	return (
		<QuestionBlock
			name={field.name}
			label={label}
			hint={hint}
			hintId={hintId}
			invalid={invalid}
			error={fieldErrorText(field)}
		>
			<Textarea
				id={field.name}
				name={field.name}
				value={value}
				onBlur={field.handleBlur}
				onChange={(event) => field.handleChange(event.target.value)}
				placeholder={placeholder}
				maxLength={1000}
				aria-invalid={invalid}
				aria-describedby={cn(hint && hintId, counterId)}
				className={cn(
					"block min-h-[104px] w-full resize-none rounded-xl bg-card px-[14px] py-[13px] text-[15px] leading-[1.45] transition-[border-color,box-shadow] placeholder:text-[color-mix(in_oklab,var(--muted-foreground)_78%,var(--card))] focus:border-ring focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_32%,transparent)] focus:outline-none",
					invalid ? "border-destructive" : "border-input",
				)}
			/>
			<span
				id={counterId}
				className="mt-1.5 block text-right text-[12px] text-muted-foreground tabular-nums"
			>
				{value.length} / 1000
			</span>
		</QuestionBlock>
	);
}
