import { cn } from "@workspace/ui/lib/utils";
import { Check, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

// Small building blocks shared by the Hugin forms, drawn after the Hugin form mockups
// (.lavish/ui/p03, p04, p13). Colours come from the theme tokens, so they hold in dark mode too.
// Error text is mixed towards the foreground: darker than --destructive in light mode, lighter in
// dark mode, so it stays readable on both.

export const ERROR_TEXT = "text-[color-mix(in_oklab,var(--destructive)_82%,var(--foreground))]";
export const ERROR_BORDER = "border-destructive";

export const FOCUS_RING =
	"focus-visible:outline-3 focus-visible:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)] focus-visible:outline-offset-2";

/** A text input the way the Hugin forms draw it. 16px on phones, so iOS does not zoom in. */
export function inputClass(invalid = false): string {
	return cn(
		"block min-h-[50px] w-full min-w-0 rounded-xl border bg-card px-[14px] text-base text-foreground transition-[border-color,box-shadow] placeholder:text-[oklch(0.6_0.012_286)] focus:border-ring focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_32%,transparent)] focus:outline-none md:text-[15px]",
		invalid
			? `${ERROR_BORDER} shadow-[0_0_0_3px_color-mix(in_oklab,var(--destructive)_18%,transparent)] focus:border-destructive`
			: "border-input",
	);
}

export function textareaClass(invalid = false): string {
	return cn(inputClass(invalid), "min-h-[104px] resize-y py-[13px] leading-[1.45]");
}

export function ErrorLine({ id, children }: Readonly<{ id?: string; children: ReactNode }>) {
	return (
		<p
			id={id}
			className={cn("m-0 mt-2 flex items-start gap-1.5 font-semibold text-[13px]", ERROR_TEXT)}
		>
			<CircleAlert aria-hidden className="mt-px size-3.5 flex-none" strokeWidth={2.4} />
			<span>{children}</span>
		</p>
	);
}

/**
 * The square check drawn inside a selectable card. `inverted` is for a card that fills with the
 * primary colour when chosen.
 */
export function CheckMark({
	checked,
	inverted = false,
	className,
}: Readonly<{ checked: boolean; inverted?: boolean; className?: string }>) {
	return (
		<span
			aria-hidden
			className={cn(
				"grid size-5 flex-none place-items-center rounded-md border-[1.5px]",
				checked && !inverted && "border-primary bg-primary text-primary-foreground",
				checked &&
					inverted &&
					"border-primary-foreground bg-primary-foreground text-primary dark:text-primary-foreground",
				!checked && "border-ring bg-card text-transparent",
				className,
			)}
		>
			<Check className="size-3.5" strokeWidth={3.2} />
		</span>
	);
}

/**
 * A checkbox with its sentence beside it, as for consent and terms. The box has a large tap area;
 * the sentence is its label and can hold links.
 */
export function CheckboxLine({
	id,
	checked,
	onChange,
	error,
	errorId,
	children,
}: Readonly<{
	id: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	error?: string;
	errorId: string;
	children: ReactNode;
}>) {
	return (
		<>
			<div className="flex items-start gap-3">
				<label className="relative -m-3 flex-none cursor-pointer p-3 has-[input:focus-visible]:[&>span]:outline-3 has-[input:focus-visible]:[&>span]:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)] has-[input:focus-visible]:[&>span]:outline-offset-2">
					<input
						id={id}
						type="checkbox"
						checked={checked}
						onChange={(event) => onChange(event.target.checked)}
						aria-invalid={Boolean(error) || undefined}
						aria-required
						aria-describedby={error ? errorId : undefined}
						className="sr-only"
					/>
					<CheckMark checked={checked} className={cn("mt-px", error && !checked && ERROR_BORDER)} />
				</label>
				<p className="m-0 text-[14px] leading-[1.45]">{children}</p>
			</div>
			{error && <ErrorLine id={errorId}>{error}</ErrorLine>}
		</>
	);
}

export const linkClass =
	"text-primary underline underline-offset-[3px] dark:text-primary-foreground";
