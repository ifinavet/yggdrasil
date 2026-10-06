import type { OrganizerRole } from "@workspace/shared/constants";
import type { TableRowMarker } from "@workspace/ui/components/table";

export const ORGANIZER_ROLE_CLASSES: Record<OrganizerRole, string> = {
	hovedansvarlig: "bg-primary text-primary-foreground",
	medhjelper: "bg-primary-light text-primary",
};

const ORGANIZER_ROLE_MARKERS: Record<OrganizerRole, string> = {
	hovedansvarlig: ORGANIZER_ROLE_CLASSES.hovedansvarlig,
	medhjelper: "bg-[color-mix(in_oklch,var(--primary),white_60%)] text-primary",
};

export function organizerMarker(
	role: OrganizerRole | null | undefined,
	past: boolean,
): TableRowMarker | null {
	if (!role) return null;
	return {
		label: `${past ? "Du var" : "Du er"} ${role === "hovedansvarlig" ? "ansvarlig" : "medansvarlig"}`,
		className: ORGANIZER_ROLE_MARKERS[role],
	};
}
