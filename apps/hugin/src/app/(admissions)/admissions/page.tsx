import { getAuthToken } from "@workspace/auth";
import { auth } from "@workspace/auth/server";
import { api } from "@workspace/backend/convex/api";
import { OSLO_TIME_ZONE } from "@workspace/shared/time";
import { fetchQuery } from "convex/nextjs";
import AdmissionsApplication from "./_components/application";

export const instant = false;

function closedPeriodPage(now: number) {
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

export default async function Page() {
	const { userId, redirectToSignIn } = await auth();
	if (!userId) return redirectToSignIn();

	const token = await getAuthToken();
	const currentApplication = await fetchQuery(api.admissions.queries.myApplication, {}, { token });
	const now = Date.now();
	const period = await fetchQuery(api.admissions.queries.openPeriod, { now }, { token });
	if (currentApplication?.status === "submitted") {
		return (
			<AdmissionsApplication
				period={
					period ?? {
						_id: currentApplication.periodId,
						...currentApplication.period,
					}
				}
			/>
		);
	}

	if (!period) return closedPeriodPage(now);

	return <AdmissionsApplication period={period} />;
}
