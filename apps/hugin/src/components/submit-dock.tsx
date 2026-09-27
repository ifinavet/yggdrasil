import { cn } from "@workspace/ui/lib/utils";
import { BusyLabel, primaryButtonClass } from "./form-buttons";
import { ERROR_TEXT } from "./form-controls";

/**
 * The send button docked to the bottom of a Hugin form, with an optional status beside it
 * («3 / 12», or «2 felt mangler svar» in red after a failed send). `bleed` stretches the dock to
 * the screen edges on phones, past the page gutter.
 */
export function SubmitDock({
	label,
	busyLabel,
	isSubmitting,
	disabled = false,
	status,
	statusIsError = false,
	bleed = false,
}: Readonly<{
	label: string;
	busyLabel: string;
	isSubmitting: boolean;
	disabled?: boolean;
	status?: string;
	statusIsError?: boolean;
	bleed?: boolean;
}>) {
	return (
		<div
			className={cn(
				"sticky bottom-0 z-6 border-border border-t bg-[color-mix(in_oklab,var(--background)_92%,transparent)] pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-[6px]",
				bleed && "mx-[calc(var(--page-gutter)*-1)] px-(--page-gutter) lg:mx-0 lg:px-0",
			)}
		>
			<div className="flex items-center gap-3">
				{status !== undefined && (
					<span
						role="status"
						aria-live="polite"
						className={cn(
							"whitespace-nowrap font-semibold text-[12.5px] tabular-nums",
							statusIsError ? ERROR_TEXT : "text-muted-foreground",
						)}
					>
						{status}
					</span>
				)}
				<button
					type="submit"
					disabled={isSubmitting || disabled}
					className={cn(primaryButtonClass, "flex-1")}
				>
					<BusyLabel busy={isSubmitting} idle={label} busyText={busyLabel} />
				</button>
			</div>
		</div>
	);
}
