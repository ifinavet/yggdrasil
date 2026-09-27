import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { preloadQuery } from "convex/nextjs";
import { JobListingsOverview } from "@/components/job-listings/overview/job-listings-overview";

export default async function JobListingsPage() {
	const token = await getAuthToken();
	const preloadedListings = await preloadQuery(api.jobListings.queries.getAll, {}, { token });

	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Stillingsannonser</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<JobListingsOverview preloadedListings={preloadedListings} now={Date.now()} />
		</>
	);
}
