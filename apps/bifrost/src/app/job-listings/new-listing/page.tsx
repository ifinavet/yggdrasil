import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Suspense } from "react";
import NewJobListingForm from "./new-job-listing-form";

export default async function NewListingPage() {
	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink href="/job-listings">
							Stillingsannonser
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbItem>Opprett ny stillingsannonse</BreadcrumbItem>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<Suspense fallback={null}>
				<NewJobListingForm />
			</Suspense>
		</>
	);
}
