import { auth } from "@clerk/nextjs/server";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getAllInternalMembers } from "@/lib/queries/organization";
import UpdateEventForm from "./update-event-form";
import { api } from "@workspace/backend/convex/api";
import { Id } from "@workspace/backend/convex/dataModel";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";

export default async function EventPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const eventId = params.slug;

  if (!eventId || typeof eventId !== 'string' || eventId.length < 10) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <h1 className="text-2xl font-bold mb-4">Ugyldig arrangement-ID</h1>
        <p className="text-gray-600 mb-4">Arrangementet du prøver å åpne eksisterer ikke.</p>
        <Button asChild>
          <Link
            href="/events"
          >
            Tilbake til arrangementer
          </Link>
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
      queryFn: () => fetchQuery(api.events.getById, { id: eventId as Id<"events"> }),
    });

    // Prefetch internal members
    await queryClient.prefetchQuery({
      queryKey: ["internalMembers", orgId],
      queryFn: () => getAllInternalMembers(orgId),
    });

  } catch (error) {
    console.error("Error prefetching data:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <h1 className="text-2xl font-bold mb-4">Kunne ikke laste arrangement</h1>
        <p className="text-gray-600 mb-4">Det oppstod en feil ved lasting av arrangementet. Dette kan skje hvis arrangementet ikke eksisterer eller er blitt slettet.</p>
        <Button asChild>
          <Link
            href="/events"
          >
            Tilbake til arrangementer
          </Link>
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
