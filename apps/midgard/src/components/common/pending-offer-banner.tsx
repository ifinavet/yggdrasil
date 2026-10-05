"use client";

import { Authenticated } from "@workspace/auth/convex";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Note } from "@workspace/ui/components/note";
import { useQuery } from "convex/react";
import { Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function PendingOfferBanner() {
	return (
		<Authenticated>
			<AdmissionsBanner />
			<PendingOffers />
		</Authenticated>
	);
}

function AdmissionsBanner() {
	const [now, setNow] = useState(() => Date.now());
	const periods = useQuery(api.admissions.queries.openPeriods, { now });
	useEffect(() => {
		if (!periods?.length) return;
		const nextDeadline = Math.min(...periods.map((period) => period.applicationEndAt));
		const timer = window.setTimeout(
			() => setNow(Date.now()),
			Math.max(0, nextDeadline - Date.now() + 1),
		);
		return () => window.clearTimeout(timer);
	}, [periods]);
	if (!periods?.length) return null;
	return (
		<>
			{periods.map((period) => (
				<OpenAdmission key={period._id} period={period} />
			))}
		</>
	);
}

function OpenAdmission({
	period,
}: Readonly<{ period: { _id: Id<"admissionPeriods">; title: string } }>) {
	const application = useQuery(api.admissions.queries.myApplication, { periodId: period._id });
	if (application === undefined || application?.status === "submitted") return null;
	return (
		<div className="mx-4 mb-6 flex max-w-6xl flex-col gap-3 sm:mx-auto sm:w-full sm:px-6">
			<Note
				tone="warn"
				icon={Info}
				role="status"
				className="bg-warning-surface text-warning-surface-foreground sm:items-center sm:[&>svg]:mt-0"
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p>Opptaket {period.title} er åpent for søknader.</p>
					<Button size="sm" asChild className="self-start sm:self-auto">
						<Link href={`${huginUrl()}/admissions`}>Søk her</Link>
					</Button>
				</div>
			</Note>
		</div>
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
