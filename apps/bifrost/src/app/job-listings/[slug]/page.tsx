import type { Id } from "@workspace/backend/convex/dataModel";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import EditJobListingForm from "./edit-job-listing-form";

export default async function EditJobListingPage({
	params,
}: Readonly<{
	params: Promise<{ slug: Id<"jobListings"> }>;
}>) {
	const { slug: listingId } = await params;

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
						<BreadcrumbPage>Rediger stillingsannonse</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<EditJobListingForm listingId={listingId} />
		</>
	);
}
