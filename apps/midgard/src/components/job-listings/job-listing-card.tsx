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
}: Readonly<{
	listingId: Id<"jobListings">;
	type: string;
	image: string;
	companyName: string;
	title: string;
	teaser: string;
}>) {
	const typeColors: Record<string, string> = {
		Sommerjobb: "bg-orange-400",
		Fulltid: "bg-indigo-400",
		Deltid: "bg-emerald-400",
		Internship: "bg-fuchsia-400",
	};

	return (
		<div
			key={listingId}
			className="flex h-[450px] w-full max-w-80 flex-col overflow-clip rounded-lg bg-white shadow-md dark:bg-zinc-800"
		>
			<div
				className={`py-4 text-center ${typeColors[type] ?? "bg-gray-400"} font-semibold text-lg text-primary-foreground`}
			>
				{type}
			</div>
			<div className="relative h-32 min-h-32 px-10 pt-4 dark:bg-zinc-100/95">
				<Image
					src={image}
					alt={companyName}
					fill
					className=" object-contain px-4 py-2"
				/>
			</div>
			<div className="flex flex-1 flex-col justify-between gap-6 px-8 pb-6">
				<div className="pt-4">
					<h4 className="line-clamp-1 scroll-m-20 text-center font-semibold text-primary text-xl tracking-tight dark:text-primary-foreground">
						{title}
					</h4>
					<p className="mt-2 line-clamp-3">{teaser}</p>
				</div>
				<Button
					asChild
					className="mt-4 text-primary-foreground dark:bg-primary-light dark:text-primary"
				>
					<Link href={`/job-listings/${listingId}`}>Les mer</Link>
				</Button>
			</div>
		</div>
	);
}
