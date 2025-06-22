import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { Registrations } from "./registrations";
import { getAllRegistrations } from "@/lib/queries/registrations";

export default async function registrations(props: { params: Promise<{ slug: number }> }) {
  const { slug: event_id } = await props.params;

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["registrations", event_id],
    queryFn: () => getAllRegistrations(event_id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Registrations event_id={event_id} />
    </HydrationBoundary>
  );
}
