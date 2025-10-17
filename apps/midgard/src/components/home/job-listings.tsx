import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import ResponsiveCenterContainer from "../common/responsive-center-container";
import JobListingCard from "../job-listings/job-listing-card";

export default async function JobListings() {
	const jobListings = await fetchQuery(api.listings.getAllPublishedAndActive, {
		n: 3,
	});

	return (
		jobListings.length > 0 && (
			<div className="relative h-full max-w-screen py-4">
				<div
					className="pointer-events-none absolute inset-0 bg-[url(/Ns.svg)] bg-center bg-cover opacity-30"
					aria-hidden="true"
				/>
				<div className="relative z-10">
					<ResponsiveCenterContainer className="space-y-6">
						<h1 className="font-bold text-4xl text-primary dark:text-primary-foreground">
							Stillingsannonser
						</h1>
						<div className="flex flex-col items-center justify-evenly gap-6 md:flex-row">
							{jobListings.map((listing) => (
								<JobListingCard
									key={listing._id}
									title={listing.title}
									listingId={listing._id}
									type={listing.type}
									companyName={listing.companyName}
									teaser={listing.teaser}
									image={listing.companyLogo}
								/>
							))}
						</div>
						<div className="flex justify-center">
							<Button
								asChild
								className="mx-8 bg-emerald-600 py-6 font-semibold text-primary-foreground hover:bg-emerald-700 md:w-1/3"
							>
								<Link href={"/job-listings"}>Se alle stillingsannonser</Link>
							</Button>
						</div>
					</ResponsiveCenterContainer>
				</div>
			</div>
		)
	);
}
