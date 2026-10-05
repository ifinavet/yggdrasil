import {
	coversWindow,
	isValidTimeWindows,
	type LocalMinuteWindow,
	localWindow,
	overlaps,
} from "../time/windows";

/** Minutes since midnight on an ISO calendar date in the period's time zone. */
export type AvailabilityWindow = LocalMinuteWindow;

export { localWindow, overlaps };

export const MAX_ADMISSION_AVAILABILITY_WINDOWS = 112;
export const isValidAvailability = (windows: readonly AvailabilityWindow[]) =>
	isValidTimeWindows(windows, MAX_ADMISSION_AVAILABILITY_WINDOWS);

/** Adjacent or overlapping selected blocks form a single available interval. */
export function isAvailable(windows: readonly AvailabilityWindow[], interview: AvailabilityWindow) {
	return coversWindow(windows, interview);
}
