import { cn } from "@workspace/ui/lib/utils";
import { FOCUS_RING } from "./form-controls";

// Button looks from the Hugin mockups, shared by the feedback, application and offer forms.

const BUTTON =
	"grid h-[52px] place-items-center rounded-[13px] px-4 font-semibold text-[15.5px] transition-transform duration-100 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55";

export const primaryButtonClass = cn(
	BUTTON,
	FOCUS_RING,
	"w-full bg-primary text-primary-foreground shadow-[0_12px_20px_-14px_rgba(31,40,71,0.95)]",
);

export const secondaryButtonClass = cn(
	BUTTON,
	FOCUS_RING,
	"w-full border border-input bg-card text-primary dark:text-primary-foreground",
);

/** A calm button for the answer that cannot be undone: red text on the card, no red fill. */
export const declineButtonClass = cn(
	BUTTON,
	FOCUS_RING,
	"w-full border border-[color-mix(in_oklab,var(--destructive)_45%,transparent)] bg-card text-destructive",
);

/** A quiet, link-looking button for the less common answers. */
export const quietLinkButtonClass =
	"mx-auto inline-flex min-h-11 items-center rounded-md px-2 font-medium text-[14px] text-muted-foreground underline underline-offset-[3px] hover:text-foreground focus-visible:outline-3 focus-visible:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)] disabled:cursor-not-allowed disabled:opacity-55";

/** The spinner on a busy button, in the button's text colour. */
export function Spinner({ className }: Readonly<{ className?: string }>) {
	return (
		<span
			aria-hidden
			className={cn(
				"mr-2 inline-block size-4 animate-spin rounded-full border-2 border-[color-mix(in_oklab,currentColor_35%,transparent)] border-t-current align-[-3px]",
				className,
			)}
		/>
	);
}

/** A button label that turns into a spinner and a busy text while the answer is sent. */
export function BusyLabel({
	busy,
	idle,
	busyText,
}: Readonly<{ busy: boolean; idle: string; busyText: string }>) {
	return busy ? (
		<span className="flex items-center">
			<Spinner />
			{busyText}
		</span>
	) : (
		idle
	);
}
