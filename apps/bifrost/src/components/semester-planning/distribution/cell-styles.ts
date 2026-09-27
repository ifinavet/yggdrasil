import type { CellKind } from "./cell-kind";

// Class names for the Fordeling calendar. Colour only ever means the application's status: the
// assigned date takes it (see STATUS_CHIP_CLASSES), and every other mark is neutral.

/** A column for a date Navet has closed. */
export const CLOSED_COLUMN = "bg-muted/60 dark:bg-muted/40";

/** The chip for one date in an application's row: big enough to read and to drag. */
export const CHIP_BASE =
	"mx-auto my-2 grid h-8 w-10 place-items-center rounded-lg font-semibold text-[13px] tabular-nums transition-colors";

export const CELL_KIND_CLASSES: Record<Exclude<CellKind, "got">, string> = {
	can: "border border-border bg-background text-foreground group-hover:border-foreground/40 group-hover:bg-muted",
	busy: "border border-border bg-background text-muted-foreground line-through opacity-50",
	req: "border border-foreground/40 border-dashed bg-background text-foreground group-hover:bg-muted",
};

/** A free date the dragged chip can be dropped on. */
export const DROP_TARGET =
	"ring-2 ring-primary ring-offset-1 ring-offset-card dark:ring-foreground";
