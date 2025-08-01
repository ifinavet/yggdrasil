import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { api } from "@workspace/backend/convex/api";
import { Id } from "@workspace/backend/convex/dataModel";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { Registrations } from "./registrations";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"

export default async function AdminPage({ params }: { params: Promise<{ slug: Id<"events"> }> }) {
  const { slug: eventId } = await params;

  const preloadedRegistrations = await preloadQuery(api.registration.getByEventId, { eventId });
  const event = await fetchQuery(api.events.getById, { id: eventId })

  return (
    <ResponsiveCenterContainer>

      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href='/events'>Arrangementer</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/events/${eventId}`}>{event.title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Administrer arrangementet</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Registrations preloadedRegistrations={preloadedRegistrations} />
    </ResponsiveCenterContainer>
  );
}
