import { getAuthToken } from "@workspace/auth";
import { isLocalDevelopment } from "@workspace/auth/local";
import { auth } from "@workspace/auth/server";
import { api } from "@workspace/backend/convex/api";
import { OSLO_TIME_ZONE } from "@workspace/shared/time";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import ApplicationPreview from "./application-preview";
import AdmissionsJourney from "./journey";

export const instant = false;

export default async function Page({
	searchParams,
}: Readonly<{
	searchParams: Promise<{ preview?: string }>;
}>) {
	const { preview } = await searchParams;
	if (preview) {
		if (!isLocalDevelopment) notFound();
		const now = Date.now();
		const open =
			now >= Date.parse("2026-10-01T00:00:00+02:00") &&
			now < Date.parse("2026-10-12T00:00:00+02:00");
		if ((!open && preview !== "open") || preview === "closed") {
			const month = Number(
				new Intl.DateTimeFormat("en", { month: "numeric", timeZone: OSLO_TIME_ZONE }).format(now),
			);
			return (
				<div className="mx-auto max-w-xl py-16">
					<h1 className="font-semibold text-3xl">Søknadsperioden er avsluttet</h1>
					<p className="mt-4 text-base leading-relaxed">
						Søknadsperioden for dette semesteret er ferdig. Neste opptak åpner i starten av{" "}
						{month < 7 ? "høstsemesteret" : "vårsemesteret"}.
					</p>
				</div>
			);
		}
		return <ApplicationPreview />;
	}

	const { userId, redirectToSignIn } = await auth();
	if (!userId) return redirectToSignIn();

	const token = await getAuthToken();
	const currentApplication = await fetchQuery(
		api.admissions.queries.currentApplication,
		{},
		{ token },
	);
	const now = Date.now();
	const periods = await fetchQuery(api.admissions.queries.openPeriods, { now }, { token });
	const period = periods.find((item) => item._id === currentApplication?.periodId);
	if (currentApplication?.status === "submitted") {
		return (
			<AdmissionsJourney
				period={
					period ?? {
						_id: currentApplication.periodId,
						title: currentApplication.period.title,
						applicationEndAt: currentApplication.period.applicationEndAt,
						interviewStartAt: 0,
						interviewEndAt: 0,
						retentionAt: 0,
						timezone: currentApplication.period.timezone,
					}
				}
				initialApplication={currentApplication}
			/>
		);
	}

	const openPeriod = period ?? periods[0];
	if (!openPeriod) {
		const month = Number(
			new Intl.DateTimeFormat("en", { month: "numeric", timeZone: OSLO_TIME_ZONE }).format(now),
		);
		return (
			<div className="mx-auto max-w-xl py-16">
				<h1 className="font-semibold text-3xl">Søknadsperioden er avsluttet</h1>
				<p className="mt-4 text-base leading-relaxed">
					Søknadsperioden for dette semesteret er ferdig. Neste opptak åpner i starten av{" "}
					{month < 7 ? "høstsemesteret" : "vårsemesteret"}.
				</p>
			</div>
		);
	}

	const application =
		currentApplication?.periodId === openPeriod._id
			? currentApplication
			: await fetchQuery(
					api.admissions.queries.myApplication,
					{ periodId: openPeriod._id },
					{ token },
				);

	return <AdmissionsJourney period={openPeriod} initialApplication={application} />;
}
