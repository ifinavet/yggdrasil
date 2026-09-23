import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import { Suspense } from "react";
import { FeedbackReportLink } from "@/components/feedback/feedback-report-link";
import { EventFeedbackSettings } from "@/components/feedback/event-feedback-settings";

export default function EventFeedbackPage({
	params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
	return (
		<Suspense fallback={<p>Henter arrangement …</p>}>
			<EventFeedbackContent params={params} />
		</Suspense>
	);
}
async function EventFeedbackContent({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
	const [{ slug }, token] = await Promise.all([params, getAuthToken()]);
	const event = await fetchQuery(api.events.queries.getEvent, { identifier: slug }, { token });
	return (
		<>
			<h1 className="font-semibold text-2xl">{event.title}</h1>
			<EventFeedbackSettings eventId={event._id} />
			<FeedbackReportLink slug={slug} />
		</>
	);
}
