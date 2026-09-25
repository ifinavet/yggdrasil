import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { cn } from "@workspace/ui/lib/utils";

const PEER_FOCUS =
	"peer-focus-visible:outline-3 peer-focus-visible:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)] peer-focus-visible:outline-offset-2";

/** A chosen card fills with the primary colour; an unanswered one gets a red border when invalid. */
function cardTone(selected: boolean, invalid: boolean): string {
	if (selected) return "border-primary bg-primary text-primary-foreground";
	return cn("bg-card text-foreground", invalid ? "border-destructive" : "border-input");
}

export type ChoiceOption<T extends string> = { value: T; label: string; description?: string };

/**
 * Radio cards on RadioGroup, for a question with a few answers. `stack` draws one card per row
 * with a radio dot and an optional second line; `row` draws equal segments side by side, as for
 * Ja / Nei.
 */
export function ChoiceGroup<T extends string>({
	name,
	options,
	value,
	onChange,
	layout = "stack",
	invalid = false,
	labelledBy,
	describedBy,
	required = true,
}: Readonly<{
	name: string;
	options: readonly ChoiceOption<T>[];
	value: T | "";
	onChange: (value: T) => void;
	layout?: "stack" | "row";
	invalid?: boolean;
	labelledBy: string;
	describedBy?: string;
	required?: boolean;
}>) {
	return (
		<RadioGroup
			name={name}
			value={value}
			onValueChange={(next) => onChange(next as T)}
			aria-labelledby={labelledBy}
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			aria-required={required}
			className={cn(
				"grid gap-2",
				layout === "row" && "auto-cols-fr grid-flow-col max-[359px]:grid-flow-row",
			)}
		>
			{options.map((option) => {
				const selected = value === option.value;
				const id = `${name}_${option.value}`;
				return (
					<div key={option.value} className="relative">
						<RadioGroupItem value={option.value} id={id} className="peer sr-only" />
						<label
							htmlFor={id}
							className={cn(
								"relative flex min-h-[54px] cursor-pointer items-center gap-3 rounded-xl border px-[14px] py-2.5 font-semibold text-[15px] leading-[1.3] transition-[background-color,border-color,color] duration-150 active:scale-[0.99]",
								PEER_FOCUS,
								layout === "row" && "h-full justify-center text-center",
								cardTone(selected, invalid),
							)}
						>
							{layout === "stack" && (
								<span
									aria-hidden
									className={cn(
										"size-[18px] flex-none rounded-full border-[1.5px]",
										selected
											? "border-primary-foreground bg-primary-foreground shadow-[inset_0_0_0_4px_var(--primary)]"
											: "border-ring",
									)}
								/>
							)}
							<span>
								{option.label}
								{option.description && (
									<small
										className={cn(
											"mt-0.5 block font-normal text-[13px]",
											selected ? "text-[oklch(0.88_0.02_274)]" : "text-muted-foreground",
										)}
									>
										{option.description}
									</small>
								)}
							</span>
						</label>
					</div>
				);
			})}
		</RadioGroup>
	);
}
