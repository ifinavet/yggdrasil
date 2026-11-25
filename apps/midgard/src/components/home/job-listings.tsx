import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import {
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@workspace/ui/components/carousel";
import ResponsiveCenterContainer from "@workspace/ui/components/responsive-center-container";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { hasJobListingsCarouselControls } from "@/lib/job-listings-carousel-controls";
import JobListingCard from "../job-listings/job-listing-card";
import JobListingsCarousel from "./job-listings-carousel";

export default async function JobListings() {
	"use cache";
	cacheLife("hours");

	const jobListings = await fetchQuery(api.jobListings.queries.getAllPublishedAndActive, {});

	return (
		jobListings.length > 0 && (
			<div className="relative h-full max-w-screen py-4">
				<div
					className="pointer-events-none absolute inset-0 bg-[url(/Ns.svg)] bg-center bg-cover dark:opacity-50"
					aria-hidden="true"
				/>
				<div className="relative z-10">
					<ResponsiveCenterContainer className="space-y-6">
						<h1 className="font-bold text-4xl text-primary dark:text-primary-foreground">
							Stillingsannonser
						</h1>
						<JobListingsCarousel className="mx-12">
							<CarouselContent>
								{jobListings.map((listing) => (
									<CarouselItem
										key={listing._id}
										className="flex justify-center py-3 md:basis-1/2 lg:basis-1/3"
									>
										<JobListingCard
											title={listing.title}
											listingId={listing._id}
											type={listing.type}
											companyName={listing.companyName}
											teaser={listing.teaser}
											image={listing.companyLogo}
										/>
									</CarouselItem>
								))}
							</CarouselContent>
							{hasJobListingsCarouselControls(jobListings.length) && (
								<>
									<CarouselPrevious />
									<CarouselNext />
								</>
							)}
						</JobListingsCarousel>
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
