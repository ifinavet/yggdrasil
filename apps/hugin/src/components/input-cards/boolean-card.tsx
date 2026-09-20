import type { AnyFieldApi } from "@tanstack/react-form";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { cn } from "@workspace/ui/lib/utils";
import { fieldErrorText, isFieldInvalid, QuestionBlock, questionIds } from "./question-block";

const CHOICES = [
	{ value: "ja", text: "Ja" },
	{ value: "nei", text: "Nei" },
] as const;

export function BooleanCard({ field, label }: Readonly<{ field: AnyFieldApi; label: string }>) {
	const invalid = isFieldInvalid(field);
	const { promptId, errorId } = questionIds(field.name);

	return (
		<QuestionBlock name={field.name} label={label} invalid={invalid} error={fieldErrorText(field)}>
			<RadioGroup
				value={field.state.value}
				onValueChange={(next) => field.handleChange(next)}
				className="grid grid-cols-2 gap-2"
				aria-labelledby={promptId}
				aria-describedby={invalid ? errorId : undefined}
				aria-invalid={invalid}
				aria-required
			>
				{CHOICES.map(({ value, text }) => {
					const id = `${field.name}_${value}`;
					const selected = field.state.value === value;

					return (
						<div key={value} className="relative">
							<RadioGroupItem value={value} id={id} className="peer sr-only" />
							<Label
								htmlFor={id}
								className={cn(
									"grid h-[54px] cursor-pointer place-items-center rounded-xl border bg-card font-semibold text-[15px] transition-[background-color,border-color,color] duration-150 peer-focus-visible:outline-3 peer-focus-visible:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)] peer-focus-visible:outline-offset-2",
									selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
								)}
							>
								{text}
							</Label>
						</div>
					);
				})}
			</RadioGroup>
		</QuestionBlock>
	);
}
