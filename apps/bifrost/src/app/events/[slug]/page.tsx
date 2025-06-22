import { auth } from "@clerk/nextjs/server";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import UpdateEventForm from "./update-event-form";
import { getAllCompanies } from "@/lib/queries/companies";
import { getAllInternalMembers } from "@/lib/queries/users";
import { getEventById } from "@/lib/queries/events";

export default async function EventPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const event_id = parseInt(params.slug);

  const { orgId, redirectToSignIn } = await auth();
  if (!orgId) return redirectToSignIn();

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["companies"],
    queryFn: getAllCompanies,
  });

  await queryClient.prefetchQuery({
    queryKey: ["internalMembers", orgId],
    queryFn: () => getAllInternalMembers(orgId),
  });

  await queryClient.prefetchQuery({
    queryKey: ["event", event_id],
    queryFn: () => getEventById(event_id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UpdateEventForm orgId={orgId} event_id={event_id} />
    </HydrationBoundary>
  );
}
