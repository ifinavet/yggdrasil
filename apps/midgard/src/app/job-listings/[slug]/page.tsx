import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { fetchQuery } from "convex/nextjs";
import { BriefcaseBusiness, CalendarDays } from "lucide-react";
import Image from "next/image";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import SanitizeHtml from "@/components/common/sanitize-html";
import { Title } from "@/components/common/title";
import { humanReadableDateTime } from "@/utils/dateFormatting";

export default async function JobListingPage({
	params,
}: {
	params: Promise<{ slug: Id<"jobListings"> }>;
}) {
	await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate loading delay
	const listingId = await params.then((params) => params.slug);

	const listing = await fetchQuery(api.listings.getById, { id: listingId });
	const company = await fetchQuery(api.companies.getById, { id: listing.company });

	return (
		<ResponsiveCenterContainer>
			<Title>{listing.title}</Title>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-5">
				<main className="gap-4 md:col-span-3">
					<div>
						<div className="grid h-fit grid-cols-2 items-center justify-between gap-4 rounded-xl bg-primary px-10 pt-6 pb-12 text-primary-foreground md:px-16 md:pt-8">
							<p className="flex items-center gap-2 text-pretty font-semibold md:text-lg">
								<CalendarDays className="size-8" />{" "}
								{humanReadableDateTime(new Date(listing.deadline))}
							</p>
							<p className="flex items-center gap-2 font-semibold md:text-lg">
								<BriefcaseBusiness className="size-8" /> {listing.type}
							</p>
						</div>
						<div className="-mt-8 mb-8 flex justify-center">
							<Button
								type="button"
								className={`w-3/4 rounded-xl bg-emerald-600 py-8 text-center font-semibold text-lg text-primary-foreground hover:cursor-pointer hover:bg-emerald-700`}
								asChild
							>
								<a href={listing.applicationUrl} target="_blank" rel="noopener noreferrer">
									Søk her
								</a>
							</Button>
						</div>
					</div>
					<div className="flex flex-col gap-4 rounded-xl bg-zinc-100 px-10 py-8 md:px-12 dark:bg-zinc-800">
						<h1 className="scroll-m-20 text-balance pb-2 font-bold text-3xl tracking-normal">
							{listing.teaser}
						</h1>
						<SanitizeHtml html={listing.description} className="prose dark:prose-invert" />
					</div>
				</main>
				<aside className="flex flex-col gap-8 md:col-span-2">
					<div>
						<div className="relative aspect-square w-full">
							<div className="absolute top-0 left-0 h-1/2 w-full bg-transparent"></div>
							<div className="absolute bottom-0 left-0 h-1/2 w-full rounded-t-xl bg-zinc-100 dark:bg-zinc-800"></div>
							<div className="absolute inset-12 grid place-content-center rounded-full border-2 border-neutral-300 bg-white dark:bg-zinc-100/95">
								<Image
									src={company.imageUrl}
									alt={company.name}
									width={200}
									height={200}
									className="p-4"
									loading="eager"
								/>
							</div>
						</div>
						<div className="rounded-b-xl bg-zinc-100 px-8 pb-8 dark:bg-zinc-800">
							<SanitizeHtml html={company.description} className="prose-lg dark:prose-invert" />
						</div>
					</div>
					<div className="grid grid-cols-1 gap-4">
						{listing.contacts.map((contact) => (
							<div
								key={contact.id}
								className="flex flex-wrap gap-4 rounded-xl bg-zinc-100 px-6 py-4 dark:bg-zinc-800"
							>
								<div className="flex flex-col justify-between">
									<div>
										<p className="font-semibold text-lg">Har du spørsmål?</p>
										<p>Kontakt: {contact.name}</p>
									</div>
									{contact.email && (
										<Button variant="link" className="justify-start px-0" asChild>
											<a href={`mailto:${contact.email}`}>Send epost til {contact.email}</a>
										</Button>
									)}
									{contact.phone && (
										<Button variant="link" className="justify-start px-0" asChild>
											<a href={`tel:${contact.phone}`}>Ring {contact.phone}</a>
										</Button>
									)}
								</div>
							</div>
						))}
					</div>
				</aside>
			</div>
		</ResponsiveCenterContainer>
	);
}
