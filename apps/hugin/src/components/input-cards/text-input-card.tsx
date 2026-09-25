import type { AnyFieldApi } from "@tanstack/react-form";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { CharacterCount } from "../character-count";
import { fieldErrorText, isFieldInvalid, QuestionBlock, questionIds } from "./question-block";

const MAX_LENGTH = 1000;

export function TextInputCard({
	field,
	number,
	label,
	placeholder,
	required,
}: Readonly<{
	field: AnyFieldApi;
	number: number;
	label: string;
	placeholder: string;
	required?: boolean;
}>) {
	const invalid = isFieldInvalid(field);
	const value = String(field.state.value ?? "");
	const counterId = `${field.name}-counter`;
	const { promptId, errorId } = questionIds(field.name);

	return (
		<QuestionBlock
			name={field.name}
			number={number}
			label={label}
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
				maxLength={MAX_LENGTH}
				aria-labelledby={promptId}
				aria-invalid={invalid}
				aria-required={required}
				aria-describedby={cn(counterId, invalid && errorId)}
				className={cn(
					"block min-h-[104px] w-full resize-none rounded-xl bg-card px-[14px] py-[13px] text-[15px] leading-[1.45] transition-[border-color,box-shadow] placeholder:text-[color-mix(in_oklab,var(--muted-foreground)_78%,var(--card))] focus:border-ring focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_32%,transparent)] focus:outline-none",
					invalid ? "border-destructive" : "border-input",
				)}
			/>
			<CharacterCount id={counterId} length={value.length} max={MAX_LENGTH} />
		</QuestionBlock>
	);
}
