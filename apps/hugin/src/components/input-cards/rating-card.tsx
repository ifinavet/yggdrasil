import type { AnyFieldApi } from "@tanstack/react-form";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { cn } from "@workspace/ui/lib/utils";
import { fieldErrorText, isFieldInvalid, QuestionBlock, questionIds } from "./question-block";

const CELL_CLASS =
	"relative grid h-[54px] cursor-pointer place-items-center rounded-xl border bg-card font-semibold text-[15px] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)]";

export function RatingCard({
	field,
	label,
	low,
	high,
}: Readonly<{
	field: AnyFieldApi;
	label: string;
	low: string;
	high: string;
}>) {
	const invalid = isFieldInvalid(field);
	const value = Number(field.state.value);
	const { promptId, errorId } = questionIds(field.name);

	return (
		<QuestionBlock name={field.name} label={label} invalid={invalid} error={fieldErrorText(field)}>
			<RadioGroup
				value={String(value)}
				onValueChange={(next) => field.handleChange(Number.parseInt(next, 10))}
				className="grid gap-2"
				aria-labelledby={promptId}
				aria-describedby={invalid ? errorId : undefined}
				aria-invalid={invalid}
				aria-required
			>
				<div className="grid grid-cols-5 gap-1.5">
					{[1, 2, 3, 4, 5].map((rating) => {
						const id = `${field.name}_${rating}`;
						const selected = value === rating;

						return (
							<div key={rating} className="relative">
								<RadioGroupItem value={String(rating)} id={id} className="peer sr-only" />
								<Label
									htmlFor={id}
									className={cn(
										CELL_CLASS,
										selected
											? "border-primary bg-primary text-primary-foreground shadow-[0_6px_14px_-10px_rgba(31,40,71,0.9)]"
											: "border-input",
										invalid &&
											!selected &&
											"border-[color-mix(in_oklab,var(--destructive)_55%,var(--input))]",
									)}
								>
									{rating}
								</Label>
							</div>
						);
					})}
				</div>
				<div className="flex justify-between gap-3 text-[12.5px] text-muted-foreground">
					<span className="max-w-[46%]">{low}</span>
					<span className="max-w-[46%] text-right">{high}</span>
				</div>
			</RadioGroup>
		</QuestionBlock>
	);
}
