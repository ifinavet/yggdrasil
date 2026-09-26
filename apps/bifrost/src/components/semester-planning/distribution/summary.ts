import type { Doc } from "@workspace/backend/convex/dataModel";
import { isActiveStatus } from "../status";

type Application = Doc<"companyApplications">;

const WAITING_FOR_OFFER: ReadonlySet<Application["status"]> = new Set([
	"applied",
	"new_date_requested",
]);

/** Offers can be sent to applications with a date that are waiting for one. */
function isReadyForOffer(application: Application): boolean {
	return application.assignedDate !== undefined && WAITING_FOR_OFFER.has(application.status);
}

/**
 * What the Fordeling tab acts on: who holds which date, who can get an offer, how many are still
 * waiting for an offer or an answer and who wants another date.
 */
export function summarizeDistribution(applications: readonly Application[]) {
	const active = applications.filter((application) => isActiveStatus(application.status));
	const holders = new Map<string, Application>();
	for (const application of active) {
		if (application.assignedDate) holders.set(application.assignedDate, application);
	}

	return {
		holders,
		readyForOffer: active.filter(isReadyForOffer),
		waiting: active.filter((application) => application.status !== "confirmed").length,
		newDateRequests: active.filter((application) => application.status === "new_date_requested"),
	};
}

/**
 * The calendar order: active applications in the order they came in, then declined, rejected and
 * withdrawn ones at the bottom. It does not depend on the assigned date, so a row stays put when
 * its date is dragged somewhere else.
 */
export function sortForMatrix(applications: readonly Application[]): Application[] {
	const rank = (application: Application) => (isActiveStatus(application.status) ? 0 : 1);
	return [...applications].sort((a, b) => rank(a) - rank(b) || a._creationTime - b._creationTime);
}
