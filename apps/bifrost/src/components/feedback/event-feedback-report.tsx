"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { FeedbackReportResponses } from "@workspace/ui/components/feedback/report";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { type ReactNode, useEffect, useState } from "react";
import { ReportReview } from "./report-review";

import { useFeedbackPreviewEnabled } from "./use-feedback-preview";

export function EventFeedbackReport({
	eventId,
	summary = false,
	fallback = null,
}: Readonly<{ eventId: Id<"events">; summary?: boolean; fallback?: ReactNode }>) {
	const enabled = useFeedbackPreviewEnabled();
	return enabled ? (
		<ReportContent eventId={eventId} summary={summary} fallback={fallback} />
	) : (
		fallback
	);
}

function ReportContent({
	eventId,
	summary,
	fallback,
}: Readonly<{ eventId: Id<"events">; summary: boolean; fallback: ReactNode }>) {
	const data = useQuery(api.feedback.reports.queries.getEventReport, { eventId });
	const prepare = useMutation(api.feedback.reports.build.prepare);
	const [error, setError] = useState<string | null>(null);
	const report = data?.enabled ? data.report : null;
	const campaignToPrepare =
		data?.enabled && data.campaignStatus === "closed" && !report ? data.campaignId : null;
	useEffect(() => {
		if (campaignToPrepare)
			void prepare({ campaignId: campaignToPrepare }).catch(() =>
				setError("Kunne ikke klargjøre rapporten. Last siden på nytt for å prøve igjen."),
			);
	}, [campaignToPrepare, prepare]);
	const {
		results: answers,
		status,
		loadMore,
	} = usePaginatedQuery(
		api.feedback.reports.queries.getReportAnswers,
		report && report.status !== "building" ? { reportId: report._id } : "skip",
		{ initialNumItems: 100 },
	);
	useEffect(() => {
		if (status === "CanLoadMore") loadMore(100);
	}, [status, loadMore]);
	if (error) return <p role="alert">{error}</p>;
	if (data === undefined) return <p>Henter rapport …</p>;
	if (data && !data.enabled) return fallback;
	if (!data) return summary ? fallback : <p>Dette arrangementet har ingen innsamling.</p>;
	if (data.campaignStatus !== "closed")
		return summary ? fallback : <p>Rapporten blir tilgjengelig når innsamlingen er avsluttet.</p>;
	if (!report || report.status === "building" || status !== "Exhausted")
		return <p>Klargjør rapport …</p>;
	if (summary) return <FeedbackReportResponses report={report} answers={answers} />;
	return <ReportReview report={report} answers={answers} deliveryEnabled={data.deliveryEnabled} />;
}
