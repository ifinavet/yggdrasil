import type { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { formatOsloDate } from "@workspace/shared/time";
import type { FunctionReturnType } from "convex/server";

export { ADMISSION_SCHEDULING_DEFAULTS as defaults, roomUrl } from "@workspace/shared/admissions";

type Overview = NonNullable<FunctionReturnType<typeof api.admissions.queries.adminOverview>>;
export type Candidate = Overview["candidates"][number];
export type Interviewer = Overview["interviewers"][number];
export type Interview = Doc<"admissionInterviews">;
export type Settings = Doc<"admissionPeriods">;
export type Decision = Candidate["decision"];
export const decisions = ["pending", "shortlist", "accepted", "rejected"] as const;
export function decisionLocked(candidate: Candidate) {
	return ["pending", "accepted", "declined"].includes(candidate.offerStatus);
}
export const decisionLabels: Record<Decision, string> = {
	pending: "Til vurdering",
	shortlist: "Videre",
	accepted: "Tatt opp",
	rejected: "Avslått",
};
export function clock(minutes: number) {
	return `${Math.floor(minutes / 60)
		.toString()
		.padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}
export function dateLabel(day: string) {
	return formatOsloDate(new Date(`${day}T12:00:00Z`).getTime(), "EEE d. MMM");
}
