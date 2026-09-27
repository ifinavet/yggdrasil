export const ORGANIZER_ROLES = ["hovedansvarlig", "medhjelper"] as const;
export type OrganizerRole = (typeof ORGANIZER_ROLES)[number];
