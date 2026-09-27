"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { Panel } from "@workspace/ui/components/products/panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQuery } from "convex/react";
import { Hand } from "lucide-react";
import { useMemo } from "react";
import { DistributionBanners } from "./distribution/distribution-banners";
import { DistributionEmpty } from "./distribution/distribution-empty";
import { DistributionMatrix } from "./distribution/distribution-matrix";
import { FinalizePlanButton } from "./distribution/finalize-plan-button";
import { SendOffersButton } from "./distribution/send-offers-button";
import { sortForMatrix, summarizeDistribution } from "./distribution/summary";
import { SemesterActions } from "./semester-actions";

/**
 * The Fordeling tab: every application against every semester date, where the editor assigns
 * dates, sends the offers and finally marks the plan as finished. A closed semester is read-only.
 */
export function DistributionTab({ semester }: Readonly<{ semester: Doc<"semesters"> }>) {
	const details = useQuery(api.semesterPlanning.semesters.queries.get, {
		semesterId: semester._id,
	});
	const applications = useQuery(api.semesterPlanning.applications.queries.listForSemester, {
		semesterId: semester._id,
	});
	const requestedDates = useMemo(
		() =>
			new Map<Id<"companyApplications">, string[]>(
				(applications ?? []).flatMap((application) =>
					application.status === "new_date_requested" &&
					application.latestOffer?.status === "new_date_requested"
						? [[application._id, application.latestOffer.requestedDates ?? []]]
						: [],
				),
			),
		[applications],
	);
	const summary = useMemo(() => summarizeDistribution(applications ?? []), [applications]);
	const sorted = useMemo(() => sortForMatrix(applications ?? []), [applications]);

	if (!details || !applications) {
		return (
			<div className="grid gap-4" aria-busy>
				<Skeleton className="h-6 w-2/3" />
				<Skeleton className="h-96 w-full rounded-lg" />
			</div>
		);
	}

	if (applications.length === 0) {
		return <DistributionEmpty semester={details.semester} dates={details.dates} />;
	}

	const closed = details.semester.status === "closed";

	return (
		<div className="grid min-w-0 gap-4">
			<SemesterActions>
				{/* A closed semester refuses offers, so the bulk button is left out, as it is with none to make. */}
				{!closed && summary.readyForOffer.length > 0 && (
					<SendOffersButton applications={summary.readyForOffer} />
				)}
				<FinalizePlanButton semester={details.semester} waiting={summary.waiting} />
			</SemesterActions>

			<DistributionBanners
				semester={details.semester}
				finalizedByName={details.finalizedByName}
				newDateRequests={summary.newDateRequests}
				requestedDates={requestedDates}
			/>

			<section aria-label="Fordeling av datoer" className="min-w-0">
				<Panel className="pt-4 pb-1">
					{!closed && (
						<p className="flex items-center gap-2 px-4 pb-3.5 text-[12.5px] text-muted-foreground">
							<Hand className="size-3.5 shrink-0" aria-hidden />
							Klikk en dato for å tildele den. Med mus kan du også dra den tildelte datoen til en
							annen.
						</p>
					)}
					{details.dates.length > 0 ? (
						<DistributionMatrix
							applications={sorted}
							dates={details.dates}
							holders={summary.holders}
							requestedDates={requestedDates}
							semesterClosed={closed}
						/>
					) : (
						<p className="border-t px-4 py-10 text-center text-muted-foreground text-sm">
							Semesteret har ingen datoer ennå. Sett første og siste dato under Innstillinger.
						</p>
					)}
				</Panel>
			</section>
		</div>
	);
}
