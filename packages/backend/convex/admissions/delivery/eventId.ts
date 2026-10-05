import { createHash } from "node:crypto";

export function admissionCalendarEventId(interviewId: string) {
	return createHash("sha256").update(`navet-admissions:${interviewId}`).digest("hex");
}
