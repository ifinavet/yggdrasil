"use client";

import { api } from "@workspace/backend/convex/api";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import { HorizontalMultipleChoiseAggregateBarChartCard } from "./cards/horizontal-chart";
import RatingBarChartCard from "./cards/rating-bar-chart";
import TextResponseCard from "./cards/text-responses";
import YesNoPieChart from "./cards/yes-no-pie-chart";

export default function EventFeedbackFormResponses({
	preloadedEvent,
}: Readonly<{ preloadedEvent: Preloaded<typeof api.events.queries.getEvent> }>) {
	const event = usePreloadedQuery(preloadedEvent);
	const responses = useQuery(
		api.forms.queries.getFormResponsesByFormId,
		event.formId ? { formId: event.formId } : "skip",
	);

	if (!event.formId) {
		return <div>Dette arrangementet har ingen tilbakemeldingsskjema.</div>;
	}

	if (!responses || responses.length === 0) {
		return (
			<div>
				Vi fant ingen tilbakemeldinger. Hvis du nettop har sendt ut mail så tar det nok litt tid før
				folk svarer.
			</div>
		);
	}

	const responseData = responses.map((response) => response.data);

	return (
		<div className="flex flex-col gap-4">
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<RatingBarChartCard
					data={responseData}
					ratingKey="satisfaction"
					color="--chart-1"
					title="Hvordan synes du arrangementet var?"
					description="Fordeling (1–5)"
				/>
				<RatingBarChartCard
					data={responseData}
					ratingKey="impression"
					color="--chart-2"
					title="Hvilket inntrykk fikk du av bedriften?"
					description="Fordeling (1–5)"
				/>
				<RatingBarChartCard
					data={responseData}
					ratingKey="expectation"
					color="--chart-3"
					title="Var arrangementet som forventet?"
					description="Fordeling (1–5)"
				/>
				<YesNoPieChart
					data={responseData}
					ratingKey="want_to_work"
					title="Kan du tenke deg å jobbe for bedriften?"
					description="Fordeling av svar (ja/nei)"
				/>
				<HorizontalMultipleChoiseAggregateBarChartCard
					data={responseData}
					ratingKey="word_of_mouth"
					title="Hvordan fikk du høre om arrangementet"
					description="Antall som huket av på hver boks"
				/>
			</div>
			<TextResponseCard
				responses={responses}
				filterKey="toughts"
				title="Hva syntes du om arrangementet og bedriften?"
				description="Innsendte tanker"
			/>
			<TextResponseCard
				responses={responses}
				filterKey="improvements"
				title="Hva kunne gjort arrangementet bedre?"
				description="Innsendte tanker"
			/>
			<TextResponseCard
				responses={responses}
				filterKey="other"
				title="Annet?"
				description="Innsedte tanker om andre ting"
			/>
		</div>
	);
}
