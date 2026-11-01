export const ORGANIZATION_GUIDE_STORAGE_KEY = "organization-guide-seen";

export const ORGANIZATION_GUIDE_STEPS = ["board", "add", "remove", "slack"] as const;

export type OrganizationGuideStep = (typeof ORGANIZATION_GUIDE_STEPS)[number];
