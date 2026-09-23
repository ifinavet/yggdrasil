"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { FeedbackReportView } from "@workspace/ui/components/feedback/report";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { useFeedbackPreviewEnabled } from "./use-feedback-preview";

export function EventFeedbackReport({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const enabled = useFeedbackPreviewEnabled();
	return enabled ? <ReportContent eventId={eventId} /> : null;
}

function ReportContent({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const data = useQuery(api.feedback.reports.queries.getEventReport, { eventId });
	const prepare = useMutation(api.feedback.reports.build.prepare);
	const [error, setError] = useState<string | null>(null);
	const report = data?.enabled ? data.report : null;
	const campaignToPrepare = data?.enabled && data.campaignStatus === "closed" && !report ? data.campaignId : null;
	useEffect(() => {
		if (campaignToPrepare) void prepare({ campaignId: campaignToPrepare }).catch(() => setError("Kunne ikke klargjøre rapporten. Last siden på nytt for å prøve igjen."));
	}, [campaignToPrepare, prepare]);
	const { results: answers, status, loadMore } = usePaginatedQuery(
		api.feedback.reports.queries.getReportAnswers,
		report?.status === "draft" ? { reportId: report._id } : "skip",
		{ initialNumItems: 100 },
	);
	useEffect(() => {
		if (status === "CanLoadMore") loadMore(100);
	}, [status, loadMore]);
	if (error) return <p role="alert">{error}</p>;
	if (data === undefined) return <p>Henter rapport …</p>;
	if (data && !data.enabled) return null;
	if (!data) return <p>Dette arrangementet har ingen innsamling.</p>;
	if (data.campaignStatus !== "closed") return <p>Rapporten blir tilgjengelig når innsamlingen er avsluttet.</p>;
	if (!report || report.status === "building" || status !== "Exhausted") return <p>Klargjør rapport …</p>;
	return <div className="mx-auto w-full max-w-[800px] overflow-hidden rounded-[10px] border bg-card"><FeedbackReportView report={report} answers={answers} /></div>;
}
