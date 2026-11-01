import type { OrganizerRole } from "@workspace/shared/constants";
import type { TableRowMarker } from "@workspace/ui/components/table";

export const ORGANIZER_ROLE_CLASSES: Record<OrganizerRole, string> = {
	hovedansvarlig: "bg-primary text-primary-foreground",
	organsvarlig: "bg-primary text-primary-foreground",
	medhjelper: "bg-primary-light text-primary",
};

const ROLE_WORDS: Record<OrganizerRole, string> = {
	hovedansvarlig: "ansvarlig",
	organsvarlig: "org-ansvarlig",
	medhjelper: "medansvarlig",
};

export function organizerMarker(
	role: OrganizerRole | null | undefined,
	past: boolean,
): TableRowMarker | null {
	if (!role) return null;
	return {
		label: `${past ? "Du var" : "Du er"} ${ROLE_WORDS[role]}`,
		className: ORGANIZER_ROLE_CLASSES[role],
	};
}
