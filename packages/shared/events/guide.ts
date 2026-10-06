export const EVENTS_LIST_GUIDE_STORAGE_KEY = "events-list-guide-seen";

export const EVENTS_LIST_GUIDE_STEPS = ["search", "semester", "create", "mine", "past"] as const;

export type EventsListGuideStep = (typeof EVENTS_LIST_GUIDE_STEPS)[number];

export const EVENT_GUIDE_STORAGE_KEY = "event-guide-seen";

export const EVENT_GUIDE_STEPS = ["checklist", "registrations", "email", "report"] as const;

export type EventGuideStep = (typeof EVENT_GUIDE_STEPS)[number];
