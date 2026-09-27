import type { AnyFieldApi } from "@tanstack/react-form";
import { ChoiceGroup } from "@workspace/ui/components/choice-group";
import { fieldErrorText, isFieldInvalid, QuestionBlock, questionIds } from "./question-block";

const CHOICES = [
	{ value: "ja", label: "Ja" },
	{ value: "nei", label: "Nei" },
] as const;

export function BooleanCard({
	field,
	number,
	label,
	required = true,
}: Readonly<{ field: AnyFieldApi; number: number; label: string; required?: boolean }>) {
	const invalid = isFieldInvalid(field);
	const { promptId, errorId } = questionIds(field.name);

	return (
		<QuestionBlock
			name={field.name}
			number={number}
			label={label}
			invalid={invalid}
			error={fieldErrorText(field)}
		>
			<ChoiceGroup
				name={field.name}
				layout="row"
				options={CHOICES}
				value={field.state.value}
				onChange={(next) => field.handleChange(next)}
				invalid={invalid}
				required={required}
				labelledBy={promptId}
				describedBy={invalid ? errorId : undefined}
			/>
		</QuestionBlock>
	);
}
