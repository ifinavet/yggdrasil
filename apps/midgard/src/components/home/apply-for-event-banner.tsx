import { api } from "@workspace/backend/convex/api";
import { UTM_CAMPAIGN, UTM_MEDIUM, UTM_SOURCE, utmParams } from "@workspace/shared/constants";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { osloToday } from "@workspace/shared/time";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import { ApplyForEventCardContent } from "@/components/companies/apply-for-event-card";
import { homeApplySemester } from "@/lib/home-apply-semester";

const APPLY_HREF = `${huginUrl()}/bestill-bedpres?${new URLSearchParams(
	utmParams({
		source: UTM_SOURCE.IFI_NAVET,
		medium: UTM_MEDIUM.BANNER,
		campaign: UTM_CAMPAIGN.EVENT_APPLICATION,
		content: "home",
	}),
)}`;

export default async function ApplyForEventBanner() {
	"use cache";
	cacheLife("minutes");

	const today = osloToday(Date.now());
	const semester = homeApplySemester(
		today,
		await fetchQuery(api.semesterPlanning.semesters.queries.listOpenForApplications, {}),
	);
	if (!semester) return null;

	return (
		<div className="mx-4 max-w-6xl sm:mx-auto sm:w-full sm:px-6">
			<ApplyForEventCardContent semester={semester} today={today} href={APPLY_HREF} />
		</div>
	);
}
