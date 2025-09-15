import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { fetchQuery, preloadedQueryResult, preloadQuery } from "convex/nextjs";
import type { Metadata } from "next";
import Image from "next/image";
import ContainerCard from "@/components/cards/container-card";
import LargeUserCard from "@/components/cards/large-user";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import SanitizeHtml from "@/components/common/sanitize-html";
import { Title } from "@/components/common/title";
import { EventMetadata } from "@/components/events/event-metadata";
import { getAuthToken } from "@/utils/authToken";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: Id<"events"> }>;
}): Promise<Metadata> {
	const { slug: eventId } = await params;
	const event = await fetchQuery(api.events.getById, { id: eventId });
	const company = await fetchQuery(api.companies.getById, { id: event.hostingCompany });

	return {
		openGraph: {
			images: [
				{
					url: company.imageUrl,
					secureUrl: company.imageUrl,
					type: "image/*",
					alt: company.name,
				},
			],
		},
		title: event.title,
		description: event.teaser,
	};
}

export default async function EventPage({ params }: { params: Promise<{ slug: Id<"events"> }> }) {
	const eventId = (await params).slug;

	const token = await getAuthToken();
	const hasAdminAccess = await fetchQuery(
		api.accsessRights.checkRights,
		{ right: ["internal", "editor", "admin", "super-admin"], },
		{ token }
	);

	const preloadedEvent = await preloadQuery(api.events.getById, { id: eventId });
	const event = preloadedQueryResult(preloadedEvent);

	const company = await fetchQuery(api.companies.getById, { id: event.hostingCompany });

	const preloadedRegistrations = await preloadQuery(api.registration.getByEventId, { eventId });


	return (
		<ResponsiveCenterContainer>
			<Title>{event.title}</Title>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-5">
				<main className="gap-4 md:col-span-3">
					<EventMetadata
						preloadedEvent={preloadedEvent}
						preloadedRegistrations={preloadedRegistrations}
					/>
					<ContainerCard>
						<h1 className="scroll-m-20 text-balance pb-2 font-bold text-3xl tracking-normal">
							{event.teaser}
						</h1>
						<SanitizeHtml html={event.description} className="prose dark:prose-invert" />
					</ContainerCard>
				</main>
				<aside className="flex flex-col gap-8 md:col-span-2">
					<div>
						<div className="relative aspect-square w-full">
							<div className="absolute top-0 left-0 h-1/2 w-full bg-transparent"></div>
							<div className="absolute bottom-0 left-0 h-1/2 w-full rounded-t-xl bg-zinc-100 dark:bg-zinc-800"></div>
							<div className="absolute inset-12 grid place-content-center rounded-full border-2 border-neutral-300 bg-white dark:bg-white/90">
								{company.imageUrl && (
									<Image
										src={company.imageUrl}
										alt={event.hostingCompanyName}
										fill
										sizes="50vw"
										className="object-contain p-10 sm:p-18 md:p-10 lg:p-16"
										loading="eager"
									/>
								)}
							</div>
						</div>
						<div className="rounded-b-xl bg-zinc-100 px-8 pb-8 dark:bg-zinc-800">
							<SanitizeHtml html={company.description} className="prose-lg dark:prose-invert" />
						</div>
					</div>
					<div className="grid grid-cols-1 gap-4">
						{event.organizers
							.sort((a, b) => {
								if (a.role === "hovedansvarlig" && b.role !== "hovedansvarlig") return -1;
								if (a.role !== "hovedansvarlig" && b.role === "hovedansvarlig") return 1;
								return 0;
							})
							.map((organizer) =>
								organizer.role === "hovedansvarlig" ? (
									<LargeUserCard
										title="Hovedansvarlig"
										key={organizer.id}
										fullName={organizer.name}
										imageUrl={organizer.imageUrl}
										email={organizer.email}
									/>
								) : (
									<div
										key={organizer.id}
										className="flex flex-wrap items-center gap-4 rounded-xl bg-zinc-100 px-6 py-4 dark:bg-zinc-800"
									>
										<img
											src={organizer.imageUrl}
											alt={organizer.name}
											className="aspect-square max-h-16 max-w-16 rounded-full"
											loading="lazy"
										/>
										<div className="flex flex-col justify-between">
											<div>
												<p className="font-semibold text-lg">Medhjelper</p>
												<p>{organizer.name}</p>
											</div>
											<Button asChild className="dark:bg-primary-light dark:text-primary">
												<a href={`mailto:${organizer.email}`} rel="noopener" target="_blank">
													Ta kontakt
												</a>
											</Button>
										</div>
									</div>
								),
							)}
					</div>
					{hasAdminAccess && (
						<Button
							variant={"outline"}
							type="button"
							className="h-18 rounded-xl border-primary font-semibold text-lg text-primary dark:text-primary-foreground"
							asChild
						>
							<a
								href={`https://bifrost.ifinavet.no/events/${eventId}/registrations`}
								rel="nofollow noopener noreferrer external"
								target="_blank"
							>
								Administrer arrangementet
							</a>
						</Button>
					)}
				</aside>
			</div>
		</ResponsiveCenterContainer>
	);
}
