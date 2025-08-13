import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import { api } from "@workspace/backend/convex/api";
import { Id } from "@workspace/backend/convex/dataModel";
import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import Register from "./register";
import { humanReadableDate } from "@/uitls/dateFormatting";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function RegistrationPage({ params }: { params: Promise<{ slug: Id<"events">, slug1: Id<"registrations"> }> }) {
  const { isAuthenticated } = await auth();
  const { slug: eventId, slug1: registrationId } = await params;

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "/";

  if (!isAuthenticated) return redirect(`/sign-in/?redirect=${pathname}`)

  const preloadedEvent = await preloadQuery(api.events.getById, { id: eventId });
  const event = preloadedQueryResult(preloadedEvent);

  const preloadedRegistration = await preloadQuery(api.registration.getById, { id: registrationId });
  const registration = preloadedQueryResult(preloadedRegistration);

  return (
    <ResponsiveCenterContainer>
      <Title>Det har blitt en ledig plass til deg!</Title>
      <h2 className="scroll-m-20 pb-2 text-3xl font-semibold tracking-tight first:mt-0 text-center mb-4">
        Arrangement: {event.title} den  {humanReadableDate(new Date(event.eventStart))}
      </h2>

      {registration.status === "pending" ? (
        <Register preloadedRegistration={preloadedRegistration} eventId={eventId} />
      ) : registration.status === "registered" ? (
        <div className="text-center">
          <p>Du er allerede registrert</p>
        </div>
      ) : (
        <div className="text-center">
          <p>Du er på venteliste</p>
        </div>)
      }
    </ResponsiveCenterContainer>
  );
}
