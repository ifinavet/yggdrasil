export const ORGANIZER_ROLES = ["hovedansvarlig", "organsvarlig", "medhjelper"] as const;
export type OrganizerRole = (typeof ORGANIZER_ROLES)[number];
