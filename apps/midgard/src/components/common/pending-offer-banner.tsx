"use client";

import { Authenticated } from "@workspace/auth/convex";
import { api } from "@workspace/backend/convex/api";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Note } from "@workspace/ui/components/note";
import { useQuery } from "convex/react";
import { Info } from "lucide-react";
import Link from "next/link";

export default function PendingOfferBanner() {
	return (
		<Authenticated>
			<PendingOffers />
		</Authenticated>
	);
}

function PendingOffers() {
	const offers = useQuery(api.events.registrations.queries.myPendingOffers);
	if (!offers?.length) return null;
	return (
		<div className="mx-4 mb-6 flex max-w-6xl flex-col gap-3 sm:mx-auto sm:w-full sm:px-6">
			{offers.map((offer) => (
				<Note
					key={offer.registrationId}
					tone="warn"
					icon={Info}
					role="status"
					className="bg-warning-surface text-warning-surface-foreground sm:items-center sm:[&>svg]:mt-0"
				>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<p>
							{`Du har fått tilbud om plass på ${offer.title}. Svar innen ${formatOsloDate(offer.answerBy, DATE_PATTERNS.dateTime)}.`}
						</p>
						<Button size="sm" asChild className="self-start sm:self-auto">
							<Link href={`/events/${offer.eventId}/registration/${offer.registrationId}`}>
								Svar på tilbudet
							</Link>
						</Button>
					</div>
				</Note>
			))}
		</div>
	);
}
