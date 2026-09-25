"use client";

import { api } from "@workspace/backend/convex/api";
import { semesterName } from "@workspace/shared/semester/labels";
import { Button } from "@workspace/ui/components/button";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { Panel } from "@workspace/ui/components/products/panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { type Preloaded, useMutation, usePreloadedQuery, useQuery } from "convex/react";
import { ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { formatMoment } from "../format";
import { SemesterplanBreadcrumb } from "../semesterplan-breadcrumb";
import { isActiveStatus } from "../status";
import { CompanyCard } from "./company-card";
import { BillingCard, ContactCard } from "./contact-card";
import { DatesCard } from "./dates-card";
import { EventInfoCard } from "./event-info-card";
import { HistoryCard } from "./history-card";
import { type ApplicationDetails, type SemesterContext, useRunMutation } from "./model";
import { PlanningCard } from "./planning-card";
import { StatusCard } from "./status-card";

/** The Søknad page in Bifrost: one application, its status and what to do next. Editors only. */
export function ApplicationPage({
	preloadedDetails,
}: Readonly<{
	preloadedDetails: Preloaded<typeof api.semesterPlanning.applications.queries.get>;
}>) {
	const details = usePreloadedQuery(preloadedDetails);
	const { application } = details;

	const semesterData = useQuery(api.semesterPlanning.semesters.queries.get, {
		semesterId: application.semesterId,
	});
	const applications = useQuery(api.semesterPlanning.applications.queries.listForSemester, {
		semesterId: application.semesterId,
	});
	const members = useQuery(api.users.organization.queries.getAll);

	const context = useMemo<SemesterContext | undefined>(() => {
		if (!semesterData || !applications || !members) return undefined;
		return {
			semester: semesterData.semester,
			dates: semesterData.dates,
			takenBy: new Map(
				applications
					.filter(
						(other) =>
							other._id !== application._id && other.assignedDate && isActiveStatus(other.status),
					)
					.map((other) => [other.assignedDate as string, other.registry.name]),
			),
			memberNames: new Map(members.map((member) => [member.userId, member.fullName])),
		};
	}, [semesterData, applications, members, application._id]);

	const companyName = details.companyName ?? application.registry.name;
	const semesterLink = `/semesterplan?semester=${application.semesterId}&tab=soknader`;

	return (
		<>
			<SemesterplanBreadcrumb
				trail={[{ label: "Søknader", href: semesterLink }, { label: companyName }]}
			/>

			<div className="mb-5 flex flex-wrap items-center gap-3">
				<CompanyLogo name={companyName} url={details.logoUrl} size="lg" />
				<div className="min-w-0">
					<h1 className="break-words font-semibold text-[22px]">{companyName}</h1>
					<p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
						{context && `${semesterName(context.semester.term, context.semester.year)} · `}
						søkte {formatMoment(application._creationTime, "longDay")} via Hugin
					</p>
				</div>
				<div className="ml-auto flex gap-2">
					<EventButton details={details} />
				</div>
			</div>

			{context ? (
				<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
					<div className="flex min-w-0 flex-col gap-4">
						<StatusCard details={details} context={context} companyName={companyName} />
						<EventInfoCard application={application} />
						<DatesCard details={details} context={context} companyName={companyName} />
					</div>
					<div className="flex min-w-0 flex-col gap-4">
						{/* The company, who to talk to and how to invoice: reference, in one card. */}
						<Panel className="divide-y">
							<CompanyCard details={details} />
							<ContactCard application={application} />
							<BillingCard application={application} />
						</Panel>
						<PlanningCard application={application} />
						<HistoryCard details={details} memberNames={context.memberNames} />
					</div>
				</div>
			) : (
				<ApplicationSkeleton />
			)}
		</>
	);
}

/**
 * «Opprett arrangement» once the application is confirmed: the backend makes an unpublished draft
 * event from the application, and the event page opens to fill it in. «Åpne arrangementet» once
 * the event exists.
 */
function EventButton({ details }: Readonly<{ details: ApplicationDetails }>) {
	const { application } = details;
	const router = useRouter();
	const createEvent = useMutation(api.semesterPlanning.applications.mutations.createEvent);
	const { pending, run } = useRunMutation();

	if (application.eventId) {
		return (
			<Button asChild variant="outline">
				<Link href={`/events/${application.eventId}`}>
					<ExternalLink /> Åpne arrangementet
				</Link>
			</Button>
		);
	}

	if (application.status === "confirmed") {
		return (
			<Button
				disabled={pending}
				onClick={() =>
					run(
						() => createEvent({ applicationId: application._id }),
						(eventId) => router.push(`/events/${eventId}`),
					)
				}
			>
				<Plus /> Opprett arrangement
			</Button>
		);
	}

	const reason = "Bare bekreftede søknader kan få et arrangement.";
	return (
		<span title={reason} className="inline-flex">
			<Button variant="outline" disabled aria-describedby="event-button-reason">
				<Plus /> Opprett arrangement
			</Button>
			<span id="event-button-reason" className="sr-only">
				{reason}
			</span>
		</span>
	);
}

export function ApplicationSkeleton() {
	return (
		<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
			<div className="grid gap-4">
				<Skeleton className="h-36 rounded-lg" />
				<Skeleton className="h-56 rounded-lg" />
				<Skeleton className="h-44 rounded-lg" />
			</div>
			<div className="grid gap-4">
				<Skeleton className="h-32 rounded-lg" />
				<Skeleton className="h-28 rounded-lg" />
				<Skeleton className="h-60 rounded-lg" />
			</div>
		</div>
	);
}
