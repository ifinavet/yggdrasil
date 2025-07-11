import { Button } from "@workspace/ui/components/button";
import { headers } from "next/headers";
import Link from "next/link";
import { Title } from "@/components/common/title";
import JobListingBanner from "@/components/job-listings/job-listing-banner";
import JobListingCard from "@/components/job-listings/job-listing-card";
import { getAllJobListings } from "@/lib/query/job-listings";

export default async function JobListingsPage() {
	const header = (await headers()).get("x-searchParams");
	let xSearchParams: URLSearchParams | undefined;
	if (header) xSearchParams = new URLSearchParams(header);

	const type = xSearchParams?.get("type") || undefined;

	const jobListings = await getAllJobListings(type);

	const types = Array.from(new Set<string>(jobListings.map((job) => job.type)));

	return (
		<div className='grid gap-6'>
			<div className='-mt-8 grid gap-4 bg-slate-300 py-8'>
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
						listingId={job.listing_id}
						type={job.type}
						teaser={job.teaser}
						companyName={job.companies.company_name}
						imageName={job.company_images.name ?? ""}
						title={job.title}
						key={job.listing_id}
					/>
				))}
			</div>
			<JobListingBanner className='mt-12' />
		</div>
	);
}
