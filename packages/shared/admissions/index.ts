export * from "./availability";
export * from "./consent";
export * from "./scheduler";

export const ADMISSION_UNSURE_GROUP = "unsure" as const;

export const ADMISSIONS_GUIDE_STORAGE_KEY = "admissions-guide-seen";

export const ADMISSIONS_GUIDE_STEPS = [
	"calendars",
	"generate",
	"approve",
	"candidates",
	"selection",
	"send",
] as const;

export type AdmissionsGuideStep = (typeof ADMISSIONS_GUIDE_STEPS)[number];

export { roomUrl } from "../constants/urls";
