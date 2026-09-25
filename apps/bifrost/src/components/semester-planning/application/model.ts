"use client";

import type { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { convexErrorMessage } from "@/utils/convex-error";
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

/** What moving a confirmed application does, for the dialogs that ask first. */
export const MOVE_CONFIRMED_WARNING =
	"Bedriften må godta den nye datoen på nytt, og et upublisert arrangement slettes.";

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
	const [pending, setPending] = useState(false);

	const run = useCallback(
		async <T>(mutation: () => Promise<T>, onSuccess?: (result: T) => void): Promise<boolean> => {
			setPending(true);
			try {
				const result = await mutation();
				onSuccess?.(result);
				return true;
			} catch (error) {
				toast.error(convexErrorMessage(error));
				return false;
			} finally {
				setPending(false);
			}
		},
		[],
	);

	return { pending, run };
}
