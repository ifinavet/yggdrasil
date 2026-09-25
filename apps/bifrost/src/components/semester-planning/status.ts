import type { ApplicationStatus } from "@workspace/shared/semester/labels";
import { CalendarSync, CircleCheck, CircleX, Clock, type LucideIcon, Send } from "lucide-react";

// Application statuses in Bifrost: whether one still counts, and its colour. Colour only ever means
// the application's status. Full class names, so Tailwind sees them.

/** Whether the application still holds its date and offer; declined, rejected and withdrawn ones do not. */
export function isActiveStatus(status: ApplicationStatus): boolean {
	return status !== "declined" && status !== "rejected" && status !== "withdrawn";
}

/** A small dot in the status colour, next to the status or a history entry. */
export const STATUS_DOT_CLASSES: Record<ApplicationStatus, string> = {
	applied: "bg-status-applied",
	offer_sent: "bg-status-offer",
	new_date_requested: "bg-status-new-date",
	confirmed: "bg-status-confirmed",
	declined: "bg-status-closed",
	rejected: "bg-status-closed",
	withdrawn: "bg-status-closed",
};

/** The symbol for a status, in its colour: in status messages and in the Plan. */
export const STATUS_ICONS: Record<ApplicationStatus, { icon: LucideIcon; className: string }> = {
	applied: { icon: Send, className: "text-muted-foreground" },
	offer_sent: { icon: Clock, className: "text-status-offer" },
	new_date_requested: { icon: CalendarSync, className: "text-status-new-date" },
	confirmed: { icon: CircleCheck, className: "text-status-confirmed" },
	declined: { icon: CircleX, className: "text-muted-foreground" },
	rejected: { icon: CircleX, className: "text-muted-foreground" },
	withdrawn: { icon: CircleX, className: "text-muted-foreground" },
};

/** A chip filled with the status colour, like the assigned date, with text that stays readable. */
export const STATUS_CHIP_CLASSES: Record<ApplicationStatus, string> = {
	applied: "bg-status-applied text-status-applied-foreground",
	offer_sent: "bg-status-offer text-status-offer-foreground",
	new_date_requested: "bg-status-new-date text-status-new-date-foreground",
	confirmed: "bg-status-confirmed text-status-confirmed-foreground",
	declined: "bg-status-closed text-status-closed-foreground",
	rejected: "bg-status-closed text-status-closed-foreground",
	withdrawn: "bg-status-closed text-status-closed-foreground",
};

/** The border and soft ring around the step an application is heading for. */
export const STATUS_RING_CLASSES: Record<ApplicationStatus, string> = {
	applied: "border-status-applied ring-status-applied/20",
	offer_sent: "border-status-offer ring-status-offer/20",
	new_date_requested: "border-status-new-date ring-status-new-date/20",
	confirmed: "border-status-confirmed ring-status-confirmed/20",
	declined: "border-status-closed ring-status-closed/20",
	rejected: "border-status-closed ring-status-closed/20",
	withdrawn: "border-status-closed ring-status-closed/20",
};
