import getCompanies from "@/lib/queries/bifrost/getCompanies";
import getEvent from "@/lib/queries/bifrost/event/getEvent";
import getInternalMembers from "@/lib/queries/bifrost/getInternalMembers";
import { auth } from "@clerk/nextjs/server";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import UpdateEventForm from "./update-event-form";

export default async function EventPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const event_id = parseInt(params.slug);
  const { orgId, redirectToSignIn } = await auth();
  if (!orgId) return redirectToSignIn();

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });

  await queryClient.prefetchQuery({
    queryKey: ["internalMembers", orgId],
    queryFn: () => getInternalMembers(orgId),
  });

  await queryClient.prefetchQuery({
    queryKey: ["event", event_id],
    queryFn: () => getEvent(event_id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UpdateEventForm orgId={orgId} event_id={event_id} />
    </HydrationBoundary>
  );
}
