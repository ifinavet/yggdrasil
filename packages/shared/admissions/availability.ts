import { isValidTimeWindows, type LocalMinuteWindow } from "../time";

export type AvailabilityWindow = LocalMinuteWindow;

export const MAX_ADMISSION_AVAILABILITY_WINDOWS = 112;
export const isValidAvailability = (windows: readonly AvailabilityWindow[]) =>
	isValidTimeWindows(windows, MAX_ADMISSION_AVAILABILITY_WINDOWS);
