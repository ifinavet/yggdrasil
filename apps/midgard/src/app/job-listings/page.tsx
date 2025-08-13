import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Title } from "@/components/common/title";
import JobListingBanner from "@/components/job-listings/job-listing-banner";
import JobListingCard from "@/components/job-listings/job-listing-card";

export const metadata: Metadata = {
	title: "Stillingsannonser",
};

export default async function JobListingsPage() {
	const header = (await headers()).get("x-searchParams");
	let xSearchParams: URLSearchParams | undefined;
	if (header) xSearchParams = new URLSearchParams(header);

	const type = xSearchParams?.get("type") || undefined;

	const jobListings = await fetchQuery(api.listings.getAllPublishedAndActive, { type });

	const types = Array.from(new Set<string>(jobListings.map((job) => job.type)));

	return (
		<div className='grid h-full gap-6'>
			<div className='-mt-8 grid h-fit gap-4 bg-zinc-100 py-8'>
				<Title className='!border-b-0'>Stillingsannonser</Title>
				<div className='flex flex-wrap justify-center gap-4'>
					<Button asChild className='md:min-w-32'>
						<Link href={`/job-listings`}>Alle</Link>
					</Button>
					{Object.values(types).map((type) => (
						<Button key={type} className='md:min-w-32'>
							<Link href={`/job-listings/?type=${type}`}>{type}</Link>
						</Button>
					))}
				</div>
			</div>
			<div className='mx-auto grid w-full max-w-5xl grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3'>
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
			<JobListingBanner className='mt-12' />
		</div>
	);
}
