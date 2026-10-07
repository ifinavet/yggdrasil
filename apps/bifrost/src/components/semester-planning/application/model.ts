"use client";

import type { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { isActiveStatus } from "../status";

export type ApplicationDetails = FunctionReturnType<
	typeof api.semesterPlanning.applications.queries.get
>;
export type Application = Doc<"companyApplications">;

/** What the application page knows about the rest of the semester. */
export type SemesterContext = {
	semester: Doc<"semesters">;
	/** Every day in the semester, closed ones included. */
	dates: Doc<"semesterDates">[];
	/** The company holding each day, for days other live applications hold. */
	takenBy: Map<string, string>;
	/** Internal members' names by user id, for the kontaktperson, the medhjelpere and the history. */
	memberNames: Map<Id<"users">, string>;
};

/** Whether an editor can give the application a date now. A confirmed one can be moved. */
export function canAssignDate(application: Application, semester: Doc<"semesters">): boolean {
	return isActiveStatus(application.status) && semester.status !== "closed";
}

/**
 * What clearing an application's date does, for the grid that asks first. Clearing gives up the
 * booking, so an unpublished event is deleted and a published one stops it.
 */
export function clearConsequence(
	application: Pick<Doc<"companyApplications">, "status" | "eventId">,
): string {
	if (application.status === "applied") return "Datoen blir ledig igjen.";
	if (application.status === "confirmed" && application.eventId) {
		return "Det upubliserte arrangementet slettes, og søknaden går tilbake til «Søkt».";
	}
	return application.status === "confirmed"
		? "Søknaden går tilbake til «Søkt»."
		: "Tilbudet som er sendt slutter å virke, og søknaden går tilbake til «Søkt».";
}

/**
 * What moving an application to another date does beyond the date, for the dialogs that ask
 * first, or nothing. An application with an event is moved together with the event, the same as
 * moving the event in the event editor.
 */
export function moveConsequence(
	application: Pick<Doc<"companyApplications">, "status" | "eventId">,
): string {
	if (application.status === "confirmed") {
		return application.eventId
			? "Arrangementet flyttes til samme tid på den nye datoen, og søknaden er fortsatt bekreftet. Bedriften og påmeldte får ikke e-post om dette."
			: "Søknaden går tilbake til «Søkt», og bedriften må godta den nye datoen på nytt.";
	}
	if (application.status === "offer_sent" || application.status === "new_date_requested") {
		return "Tilbudet som er sendt slutter å virke.";
	}
	return "";
}

/** The days the application can be given: open, and not held by another company. */
export function freeDates({ dates, takenBy }: SemesterContext): Set<string> {
	return new Set(
		dates
			.filter((date) => date.closedLabel === undefined && !takenBy.has(date.date))
			.map((date) => date.date),
	);
}

/** The offer the company is answering or answered last. */
export function latestOffer(offers: Doc<"companyApplicationOffers">[]) {
	return offers.reduce<Doc<"companyApplicationOffers"> | undefined>(
		(latest, offer) => (!latest || offer.sentAt > latest.sentAt ? offer : latest),
		undefined,
	);
}

/** The most recent history entry that moved the application to a status. */
export function lastChangeTo(
	activity: Doc<"companyApplicationActivity">[],
	status: Application["status"],
) {
	return activity
		.filter((entry) => entry.type === "status_changed" && entry.toStatus === status)
		.reduce<Doc<"companyApplicationActivity"> | undefined>(
			(latest, entry) => (!latest || entry._creationTime >= latest._creationTime ? entry : latest),
			undefined,
		);
}

/**
 * Runs a mutation and shows its Norwegian error as a toast. `pending` is true while it runs, so
 * the button that started it can be disabled.
 */
export function useRunMutation() {
	return useAsyncAction(toast.error, true);
}
