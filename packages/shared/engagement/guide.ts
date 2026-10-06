export const ENGAGEMENT_GUIDE_STORAGE_KEY = "engagement-guide-seen";

export const ENGAGEMENT_GUIDE_STEPS = ["prognosis", "select", "alerts", "past"] as const;

export type EngagementGuideStep = (typeof ENGAGEMENT_GUIDE_STEPS)[number];
