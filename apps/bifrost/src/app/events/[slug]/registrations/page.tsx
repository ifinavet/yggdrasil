import { preloadQuery } from "convex/nextjs";
import { Registrations } from "./registrations";
import { Id } from "@workspace/backend/convex/dataModel";
import { api } from "@workspace/backend/convex/api";

export default async function registrations(props: { params: Promise<{ slug: Id<"events"> }> }) {
  const { slug: eventId } = await props.params;

  const preloadedRegistrations = await preloadQuery(api.registration.getByEventId, { eventId })

  return (
    <Registrations eventId={eventId} preloadedRegistrations={preloadedRegistrations} />
  );
}
