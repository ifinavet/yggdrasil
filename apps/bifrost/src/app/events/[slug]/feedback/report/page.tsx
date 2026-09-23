import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import { Suspense } from "react";
import { EventFeedbackReport } from "@/components/feedback/event-feedback-report";

export default function FeedbackReportPage({
	params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
	return (
		<Suspense fallback={<p>Henter rapport …</p>}>
			<ReportContent params={params} />
		</Suspense>
	);
}
async function ReportContent({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
	const [{ slug }, token] = await Promise.all([params, getAuthToken()]);
	const event = await fetchQuery(api.events.queries.getEvent, { identifier: slug }, { token });
	return <EventFeedbackReport eventId={event._id} />;
}
