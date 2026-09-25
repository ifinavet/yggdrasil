import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { eventSemesterOf, isEventSemester } from "@workspace/shared/time";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { EventsOverview } from "@/components/events/overview/events-overview";

export default async function Events({
	searchParams,
}: Readonly<{ searchParams: Promise<{ year?: string; semester?: string }> }>) {
	const params = await searchParams;
	const now = Date.now();
	const current = eventSemesterOf(now);
	const year = Number.parseInt(params.year ?? "", 10) || current.year;
	const semester = isEventSemester(params.semester) ? params.semester : current.semester;

	const token = await getAuthToken();
	const [preloadedPossibleSemesters, events] = await Promise.all([
		preloadQuery(api.events.queries.getPossibleSemesters),
		fetchQuery(api.events.queries.getAll, { year, semester }, { token }),
	]);

	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Arrangementer</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<EventsOverview
				events={events}
				now={now}
				preloadedPossibleSemesters={preloadedPossibleSemesters}
			/>
		</>
	);
}
