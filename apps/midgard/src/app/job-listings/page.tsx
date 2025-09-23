import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Title } from "@/components/common/title";
import JobListingBanner from "@/components/job-listings/job-listing-banner";
import JobListingCard from "@/components/job-listings/job-listing-card";
import FilterJobListings from "@/components/job-listings/job-listings-filter";

export const metadata: Metadata = {
	title: "Stillingsannonser",
};

export default async function JobListingsPage() {
	const header = (await headers()).get("x-searchParams");
	let xSearchParams: URLSearchParams | undefined;
	if (header) xSearchParams = new URLSearchParams(header);

	const listingType = xSearchParams?.get("listingType") || undefined;
	const company = (xSearchParams?.get("company") as Id<"companies">) || undefined;
	const sorting = xSearchParams?.get("sort") || undefined;

	const jobListings = await fetchQuery(api.listings.getAllPublishedAndActive, {
		listingType,
		company,
		sorting,
	});

	const companies = Array.from(
		new Map(jobListings.map((l) => [l.company, { name: l.companyName, id: l.company }])).values(),
	).sort((a, b) => a.name.localeCompare(b.name));

	return (
		<div className="box-border space-y-6">
			<Title className="mx-auto max-w-6xl">Stillingsannonser</Title>
			<div className="flex w-full max-w-[1300px] flex-col gap-4 sm:mx-auto md:flex-row">
				<FilterJobListings companies={companies} />
				<div className="grid w-full min-w-0 grid-cols-1 items-center gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
					{jobListings.map((job) => (
						<JobListingCard
							listingId={job._id}
							type={job.type}
							teaser={job.teaser}
							companyName={job.companyName}
							image={job.companyLogo}
							title={job.title}
							key={job._id}
						/>
					))}
				</div>
			</div>
			<JobListingBanner className="mt-12" />
		</div>
	);
}
