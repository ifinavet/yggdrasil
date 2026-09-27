import { getAuthToken, hasEditRights } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { preloadQuery } from "convex/nextjs";
import { Suspense } from "react";
import { SemesterPlanner } from "@/components/semester-planning/semester-planner";
import { SemesterplanBreadcrumb } from "@/components/semester-planning/semesterplan-breadcrumb";

// Shown behind the semester planning gate, which only renders in the browser.
export const instant = false;

export default function SemesterPlanPage() {
	return (
		<>
			<SemesterplanBreadcrumb />

			{/* Rights and data need the request, so they stream in; the page shell shows at once. */}
			<Suspense fallback={<SemesterPlannerSkeleton />}>
				<LoadedSemesterPlanner />
			</Suspense>
		</>
	);
}

async function LoadedSemesterPlanner() {
	const [token, canEdit] = await Promise.all([getAuthToken(), hasEditRights()]);
	const preloadedSemesters = await preloadQuery(
		api.semesterPlanning.semesters.queries.list,
		{},
		{ token },
	);

	return <SemesterPlanner preloadedSemesters={preloadedSemesters} canEdit={canEdit} />;
}

function SemesterPlannerSkeleton() {
	return (
		<div className="grid gap-4" aria-busy>
			<div className="flex flex-wrap gap-3">
				<Skeleton className="h-9 w-40" />
				<Skeleton className="h-9 w-80" />
			</div>
			<Skeleton className="h-96 w-full rounded-lg" />
		</div>
	);
}
