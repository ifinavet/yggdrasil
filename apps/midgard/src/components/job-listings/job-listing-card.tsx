import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import Image from "next/image";
import Link from "next/link";

export default function JobListingCard({
	listingId,
	type,
	image,
	companyName,
	title,
	teaser,
}: {
	listingId: Id<"jobListings">;
	type: string;
	image: string;
	companyName: string;
	title: string;
	teaser: string;
}) {
	const typeColors: Record<string, string> = {
		Sommerjobb: "bg-orange-400",
		Fulltid: "bg-indigo-400",
		Deltid: "bg-emerald-400",
		Internship: "bg-fuchsia-400",
	};

	return (
		<div
			key={listingId}
			className='flex h-[450px] w-80 flex-col overflow-clip rounded-lg bg-white shadow-md'
		>
			<div
				className={`py-4 text-center ${typeColors[type] ?? "bg-gray-400"} mb-6 font-semibold text-lg text-white`}
			>
				{type}
			</div>
			<div className='relative h-32 min-h-32 px-10'>
				<Image src={image} alt={companyName} fill className='object-contain' />
			</div>
			<div className='flex flex-1 flex-col justify-between gap-6 px-8 pb-6'>
				<div className='pt-4'>
					<h4 className='line-clamp-1 scroll-m-20 text-center font-semibold text-primary text-xl tracking-tight'>
						{title}
					</h4>
					<p className='mt-2 line-clamp-3'>{teaser}</p>
				</div>
				<Button asChild className='mt-4'>
					<Link href={`/job-listings/${listingId}`}>Les mer</Link>
				</Button>
			</div>
		</div>
	);
}
