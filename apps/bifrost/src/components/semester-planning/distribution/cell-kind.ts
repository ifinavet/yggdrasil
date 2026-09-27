import type { Doc } from "@workspace/backend/convex/dataModel";
import { isActiveStatus } from "../status";

type Application = Doc<"companyApplications">;

/**
 * What one date shows in an application's row of the Fordeling calendar: «got» for the assigned
 * date, «req» for a free date the company asked for instead, «can» for a free date it ticked, and
 * «busy» for one of those dates it can no longer get, because another company holds it or the
 * application is closed. Null leaves the cell empty.
 */
export type CellKind = "can" | "busy" | "got" | "req";

export function cellKind({
	application,
	date,
	requested,
	holders,
}: Readonly<{
	application: Pick<Application, "_id" | "status" | "assignedDate" | "availableDates">;
	date: string;
	/** The dates the company asked for instead of its offer. */
	requested: readonly string[];
	/** The application holding each date. */
	holders: ReadonlyMap<string, Pick<Application, "_id">>;
}>): CellKind | null {
	const active = isActiveStatus(application.status);
	if (active && application.assignedDate === date) return "got";

	const isRequested = active && requested.includes(date);
	if (!isRequested && !application.availableDates.includes(date)) return null;
	const holder = holders.get(date);
	if (!active || (holder && holder._id !== application._id)) return "busy";
	return isRequested ? "req" : "can";
}
