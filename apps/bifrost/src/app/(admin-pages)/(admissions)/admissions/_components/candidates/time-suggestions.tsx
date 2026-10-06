"use client";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { formatOsloDate } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Callout } from "@workspace/ui/components/products/callout";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import type { Interviewer } from "../model";

export type TimeSuggestion = FunctionReturnType<
	typeof api.admissions.interviews.calendar.suggestTimes
>[number];

export function TimeSuggestions({
	applicationId,
	periodId,
	team,
	onPick,
}: Readonly<{
	applicationId: Id<"admissionApplications">;
	periodId: Id<"admissionPeriods">;
	team: Interviewer[];
	onPick: (suggestion: TimeSuggestion) => void;
}>) {
	const suggestTimes = useAction(api.admissions.interviews.calendar.suggestTimes);
	const [suggestions, setSuggestions] = useState<TimeSuggestion[]>();
	const { pending, error, run } = useAsyncAction();
	const load = () =>
		void run(
			() => suggestTimes({ applicationId, periodId }),
			setSuggestions,
			"Kunne ikke hente ledige tider.",
		);
	if (!suggestions)
		return (
			<div className="grid gap-3">
				{error && <Callout tone="danger">{error}</Callout>}
				<Button variant="outline" disabled={pending} onClick={load}>
					{pending ? "Leter etter ledige tider" : "Foreslå tider"}
				</Button>
			</div>
		);
	if (!suggestions.length) return <p>Fant ingen ledige tider med to intervjuere.</p>;
	return (
		<ul className="admissions-suggestions grid gap-2">
			{suggestions.map((suggestion) => (
				<li key={`${suggestion.startAt}-${suggestion.interviewerIds.join("-")}`}>
					<Button
						variant="outline"
						className="h-auto w-full flex-col items-start gap-0.5 py-2 text-left"
						onClick={() => onPick(suggestion)}
					>
						<span>{formatOsloDate(suggestion.startAt, "EEE d. MMM HH:mm")}</span>
						<span className="font-normal text-muted-foreground text-sm">
							{suggestion.interviewerIds
								.map((id) => team.find((person) => person.id === id)?.name)
								.join(" og ")}
							{!suggestion.withinAvailability && ", utenfor oppgitt tid"}
						</span>
					</Button>
				</li>
			))}
		</ul>
	);
}
