"use client";
import { api } from "@workspace/backend/convex/api";
import { midgardUrl } from "@workspace/shared/constants/hugin-url";
import { OSLO_TIME_ZONE } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApplicationForm } from "./application-form";
import { ApplicationNotice, ApplicationStatus } from "./application-status";

type Context = NonNullable<FunctionReturnType<typeof api.admissions.queries.applicationContext>>;
export type InitialApplication = Context["application"];
export type Period = Context["period"];

export default function AdmissionsApplication() {
	const [now, setNow] = useState(() => Date.now());
	const context = useQuery(api.admissions.queries.applicationContext, { now });
	const profile = useQuery(api.users.students.queries.getCurrent, { allowMissing: true });
	const period = context?.period;
	useEffect(() => {
		if (!period) return;
		const boundary =
			now < period.applicationStartAt ? period.applicationStartAt : period.applicationEndAt + 1;
		if (boundary <= now) return;
		const timer = window.setTimeout(
			() => setNow(Date.now()),
			Math.min(boundary - now, 2_147_483_647),
		);
		return () => window.clearTimeout(timer);
	}, [now, period]);

	if (context === undefined || profile === undefined) return <ApplicationLoading />;
	const application = context?.application;
	if (!context || (!context.isOpen && application?.status !== "submitted")) {
		const month = Number(
			new Intl.DateTimeFormat("en", { month: "numeric", timeZone: OSLO_TIME_ZONE }).format(now),
		);
		return (
			<ApplicationNotice title="Søknadsperioden er avsluttet">
				<p>
					Søknadsperioden for dette semesteret er ferdig. Neste opptak åpner i starten av{" "}
					{month < 7 ? "høstsemesteret" : "vårsemesteret"}.
				</p>
			</ApplicationNotice>
		);
	}
	if (!profile)
		return (
			<ApplicationNotice title="Studentprofilen din er ikke klar ennå">
				<p>Opprett studentprofilen din før du søker.</p>
				<Button asChild variant="outline">
					<Link href={`${midgardUrl()}/profile`}>Åpne profilen</Link>
				</Button>
			</ApplicationNotice>
		);
	if (application?.status === "submitted")
		return (
			<ApplicationStatus
				application={application}
				period={context.period}
				applicationWindowClosed={!context.isOpen}
			/>
		);
	return (
		<ApplicationForm
			period={context.period}
			initialApplication={application ?? null}
			profile={profile}
		/>
	);
}
function ApplicationLoading() {
	return (
		<output className="mx-auto block max-w-2xl py-16" aria-label="Laster søknaden">
			<LoaderCircle className="size-6 animate-spin" />
		</output>
	);
}
