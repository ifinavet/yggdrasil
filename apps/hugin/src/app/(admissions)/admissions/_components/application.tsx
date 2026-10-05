"use client";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { midgardUrl } from "@workspace/shared/constants/hugin-url";
import { Button } from "@workspace/ui/components/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApplicationForm } from "./application-form";
import { ApplicationNotice, ApplicationStatus } from "./application-status";
export type InitialApplication = FunctionReturnType<typeof api.admissions.queries.myApplication>;
export type Period = NonNullable<InitialApplication>["period"] & { _id: Id<"admissionPeriods"> };

export default function AdmissionsApplication({ period }: Readonly<{ period: Period }>) {
	const application = useQuery(api.admissions.queries.myApplication, { periodId: period._id });
	const profile = useQuery(api.users.students.queries.getCurrent, { allowMissing: true });
	const [applicationWindowClosed, setApplicationWindowClosed] = useState(
		() => Date.now() > period.applicationEndAt,
	);
	useEffect(() => {
		if (applicationWindowClosed) return;
		const timer = window.setTimeout(
			() => setApplicationWindowClosed(Date.now() > period.applicationEndAt),
			Math.max(0, period.applicationEndAt - Date.now() + 1),
		);
		return () => window.clearTimeout(timer);
	}, [applicationWindowClosed, period.applicationEndAt]);

	if (profile === undefined || application === undefined) return <ApplicationLoading />;
	if (!profile)
		return (
			<ApplicationNotice title="Studentprofilen din er ikke klar ennå">
				<p>Opprett studentprofilen din på Midgard før du søker.</p>
				<Button asChild variant="outline">
					<Link href={`${midgardUrl()}/profile`}>Åpne profilen</Link>
				</Button>
			</ApplicationNotice>
		);
	if (application?.status === "submitted")
		return (
			<ApplicationStatus
				application={application}
				period={period}
				applicationWindowClosed={applicationWindowClosed}
			/>
		);
	if (applicationWindowClosed)
		return (
			<ApplicationNotice title="Søknadsperioden er avsluttet">
				<p>
					Søknadsperioden for dette semesteret er ferdig. Neste opptak åpner i et nytt semester.
				</p>
			</ApplicationNotice>
		);
	return <ApplicationForm period={period} initialApplication={application} profile={profile} />;
}
function ApplicationLoading() {
	return (
		<output className="mx-auto block max-w-2xl py-16" aria-label="Laster søknaden">
			<LoaderCircle className="size-6 animate-spin" />
		</output>
	);
}
