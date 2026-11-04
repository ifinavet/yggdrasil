import { api } from "@workspace/backend/convex/api";
import { osloToday } from "@workspace/shared/time";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import { homeApplySemester } from "@/lib/home-apply-semester";
import ApplyForEventHomeCard from "./apply-for-event-home-card";
import EventsCarousel from "./events-carousel";

export default async function EventsOrApply({ className }: Readonly<{ className?: string }>) {
	"use cache";
	cacheLife("minutes");

	const today = osloToday(Date.now());
	const semester = homeApplySemester(
		today,
		await fetchQuery(api.semesterPlanning.semesters.queries.listOpenForApplications, {}),
	);
	return semester ? (
		<ApplyForEventHomeCard semester={semester} today={today} className={className} />
	) : (
		<EventsCarousel className={className} />
	);
}
