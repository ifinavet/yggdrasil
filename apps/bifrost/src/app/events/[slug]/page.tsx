import { auth } from "@clerk/nextjs/server";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { getAllInternalMembers } from "@/lib/queries/organization";
import UpdateEventForm from "./update-event-form";

export default async function EventPage({ params }: { params: Promise<{ slug: Id<"events"> }> }) {
	const { slug: eventId } = await params;

	if (!eventId || typeof eventId !== "string" || eventId.length < 10) {
		return (
			<div className='flex min-h-[400px] flex-col items-center justify-center p-8 text-center'>
				<h1 className='mb-4 font-bold text-2xl'>Ugyldig arrangement-ID</h1>
				<p className='mb-4 text-gray-600'>Arrangementet du prøver å åpne eksisterer ikke.</p>
				<Button asChild>
					<Link href='/events'>Tilbake til arrangementer</Link>
				</Button>
			</div>
		);
	}

	const { orgId, redirectToSignIn } = await auth();
	if (!orgId) return redirectToSignIn();

	const queryClient = new QueryClient();

	try {
		// Prefetch companies
		await queryClient.prefetchQuery({
			queryKey: ["companies", orgId],
			queryFn: () => fetchQuery(api.companies.getAll, {}),
		});

		// Prefetch event
		await queryClient.prefetchQuery({
			queryKey: ["event", eventId],
			queryFn: () => fetchQuery(api.events.getById, { id: eventId }),
		});

		// Prefetch internal members
		await queryClient.prefetchQuery({
			queryKey: ["internalMembers", orgId],
			queryFn: () => getAllInternalMembers(orgId),
		});
	} catch (error) {
		return (
			<div className='flex min-h-[400px] flex-col items-center justify-center p-8 text-center'>
				<h1 className='mb-4 font-bold text-2xl'>Kunne ikke laste arrangement</h1>
				<p className='mb-4 text-gray-600'>
					Det oppstod en feil ved lasting av arrangementet. Dette kan skje hvis arrangementet ikke
					eksisterer eller er blitt slettet.
				</p>
				<Button asChild>
					<Link href='/events'>Tilbake til arrangementer</Link>
				</Button>
			</div>
		);
	}

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<UpdateEventForm eventId={eventId} />
		</HydrationBoundary>
	);
}
