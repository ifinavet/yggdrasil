import type { AnyFieldApi } from "@tanstack/react-form";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";
import { fieldErrorText, isFieldInvalid, QuestionBlock, questionIds } from "./question-block";

const ROW_CLASS =
	"flex cursor-pointer items-center gap-3 rounded-xl border px-[14px] py-[13px] transition-[background-color,border-color] duration-150";
const BOX_CLASS =
	"grid size-[22px] flex-none place-items-center rounded-md border-[1.5px] transition-[background-color,border-color,color] duration-150 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)]";

export function MultipleOptionsCard({
	field,
	label,
	options,
}: Readonly<{
	field: AnyFieldApi;
	label: string;
	options: readonly string[];
}>) {
	const invalid = isFieldInvalid(field);
	const values = (field.state.value ?? []) as string[];
	const otherValue = values.find((value) => !options.includes(value));

	const [otherChecked, setOtherChecked] = useState(otherValue !== undefined);
	const [otherText, setOtherText] = useState(otherValue ?? "");

	const { promptId, errorId } = questionIds(field.name);

	const otherIndex = values.findIndex((value) => !options.includes(value));

	const toggleOption = (option: string, checked: boolean) => {
		if (checked) {
			field.pushValue(option);
			return;
		}

		const index = values.indexOf(option);
		if (index > -1) field.removeValue(index);
	};

	// Only carry a value once the field has content, so an unanswered "Annet"
	// can never satisfy the required "pick at least one" rule.
	const changeOtherText = (text: string) => {
		setOtherText(text);

		const hasContent = text.trim().length > 0;
		if (otherIndex === -1) {
			if (hasContent) field.pushValue(text);
			return;
		}

		if (hasContent) {
			field.replaceValue(otherIndex, text);
			return;
		}

		field.removeValue(otherIndex);
	};

	const toggleOther = (checked: boolean) => {
		setOtherChecked(checked);

		if (checked) {
			if (otherText.trim().length > 0) field.pushValue(otherText);
			return;
		}

		if (otherIndex > -1) field.removeValue(otherIndex);
		setOtherText("");
	};

	return (
		<QuestionBlock name={field.name} label={label} invalid={invalid} error={fieldErrorText(field)}>
			<fieldset
				aria-labelledby={promptId}
				aria-describedby={invalid ? errorId : undefined}
				className="m-0 grid gap-2 border-0 p-0"
			>
				{options.map((option, index) => {
					const checked = values.includes(option);
					const optionId = `${field.name}_${index}`;

					return (
						<label
							key={option}
							htmlFor={optionId}
							className={cn(
								ROW_CLASS,
								checked
									? "border-[color-mix(in_oklab,var(--primary)_32%,var(--input))] bg-[color-mix(in_oklab,var(--primary-light)_62%,var(--card))]"
									: "border-input bg-card",
							)}
						>
							<Checkbox
								id={optionId}
								checked={checked}
								onCheckedChange={(next) => toggleOption(option, next === true)}
								className="peer sr-only"
							/>
							<span
								className={cn(
									BOX_CLASS,
									checked
										? "border-primary bg-primary text-primary-foreground"
										: "border-input bg-white text-transparent",
								)}
							>
								<Check className="size-3.5" strokeWidth={3.2} />
							</span>
							<span className={cn("text-[15px] leading-[1.3]", checked && "font-semibold")}>
								{option}
							</span>
						</label>
					);
				})}

				<label
					htmlFor={`${field.name}_other`}
					className={cn(
						ROW_CLASS,
						otherChecked
							? "border-[color-mix(in_oklab,var(--primary)_32%,var(--input))] bg-[color-mix(in_oklab,var(--primary-light)_62%,var(--card))]"
							: "border-input bg-card",
					)}
				>
					<Checkbox
						id={`${field.name}_other`}
						checked={otherChecked}
						onCheckedChange={(next) => toggleOther(next === true)}
						className="peer sr-only"
					/>
					<span
						className={cn(
							BOX_CLASS,
							otherChecked
								? "border-primary bg-primary text-primary-foreground"
								: "border-input bg-white text-transparent",
						)}
					>
						<Check className="size-3.5" strokeWidth={3.2} />
					</span>
					<span className={cn("text-[15px] leading-[1.3]", otherChecked && "font-semibold")}>
						Annet
					</span>
				</label>

				{otherChecked && (
					<div className="mt-2 ml-[34px]">
						<Textarea
							rows={1}
							value={otherText}
							placeholder="Hva da?"
							aria-label={`Annet: ${label}`}
							onChange={(event) => changeOtherText(event.target.value)}
							className="block min-h-[56px] w-full resize-none rounded-xl border-input bg-card px-[14px] py-[13px] text-[15px] leading-[1.45] transition-[border-color,box-shadow] placeholder:text-[color-mix(in_oklab,var(--muted-foreground)_78%,var(--card))] focus:border-ring focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_32%,transparent)] focus:outline-none"
						/>
					</div>
				)}
			</fieldset>
		</QuestionBlock>
	);
}
