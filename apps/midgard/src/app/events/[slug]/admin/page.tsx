import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { api } from "@workspace/backend/convex/api";
import { Id } from "@workspace/backend/convex/dataModel";
import { preloadQuery } from "convex/nextjs";
import { Registrations } from "./registrations";

export default async function AdminPage({ params }: { params: Promise<{ slug: Id<"events"> }> }) {
  const { slug: eventId } = await params;

  const preloadedRegistrations = await preloadQuery(api.registration.getByEventId, { eventId });

  return (
    <ResponsiveCenterContainer>
      <Registrations preloadedRegistrations={preloadedRegistrations} />
    </ResponsiveCenterContainer>
  );
}
