import SanitizeHtml from "@/components/common/sanitize-html";
import RegistrationButton from "@/components/events/registration/registration-button";
import getCompanyImageById from "@/lib/query/companies/getById";
import { getEventById } from "@/lib/query/events";
import { humanReadableDateTime } from "@/uitls/dateFormatting";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@workspace/ui/components/button";
import { CalendarDays, Globe, IdCard, MapPin, Users, Utensils } from "lucide-react";
import Image from "next/image";

export default async function EventPage({ params }: { params: Promise<{ slug: number }> }) {
  const { userId } = await auth();
  const event_id = (await params).slug;

  const event = await getEventById(event_id);

  if (!event || !event.event_id || !event.company_id) {
    return <div>Event not found</div>;
  }

  const companyImage = await getCompanyImageById(event.company_id);

  const userRegistration = event.registrations.find(registration => registration.user_id === userId)

  const participantsLimit = event.participants_limit;
  const participants = event.registrations_by_status?.["registered"]?.length || 0;
  const availableSpots = participantsLimit - participants;

  return (
    <div className="mx-6 md:w-5/6 lg:w-4/5 xl:w-8/14 md:mx-auto">
      <h1 className="text-primary scroll-m-20 text-center text-4xl md:text-5xl font-extrabold tracking-tight text-balance pb-2 border-b-2 border-primary mb-4">
        {event.title}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <main className="md:col-span-3 gap-4">
          <div>
            <div className="bg-primary rounded-xl h-80 grid grid-cols-2 grid-rows-3 text-primary-foreground px-10 md:px-16 py-6 md:py-8 items-center justify-start">
              <p className="flex gap-2 items-center font-semibold md:text-lg">
                <CalendarDays className="size-8" /> {humanReadableDateTime(new Date(event?.event_start || ""))}
              </p>
              <p className="flex gap-2 items-center font-semibold md:text-lg">
                <MapPin className="size-8" /> {event.location}
              </p>
              <p className="flex gap-2 items-center font-semibold md:text-lg">
                <Utensils className="size-8" /> {event.food}
              </p>
              <p className="flex gap-2 items-center font-semibold md:text-lg">
                <Users className="size-8" /> {availableSpots} plasser igjen
              </p>
              <p className="flex gap-2 items-center font-semibold md:text-lg">
                <Globe className="size-8" /> {event.language}
              </p>
              <p className="flex gap-2 items-center font-semibold md:text-lg">
                <IdCard className="size-8" /> {event.age_restrictions}
              </p>
            </div>
            <div className="flex justify-center -mt-8 mb-8">
              <RegistrationButton event_id={event.event_id} userRegistration={userRegistration} availableSpots={availableSpots} />
            </div>
          </div>
          <div className="bg-zinc-100 rounded-xl px-10 md:px-12 py-8 flex flex-col gap-4">
            <h1 className="scroll-m-20 text-3xl font-bold tracking-normal text-balance pb-2">
              {event.teaser}
            </h1>
            <SanitizeHtml html={event.description ?? ""} className="prose" />
          </div>
        </main>
        <aside className="md:col-span-2 flex flex-col gap-8">
          <div>
            <div className="relative aspect-square w-full">
              <div className="absolute top-0 left-0 w-full h-1/2 bg-transparent"></div>
              <div className="absolute bottom-0 left-0 w-full h-1/2 bg-zinc-100 rounded-t-xl"></div>
              <div className="absolute inset-12 rounded-full bg-white border-2 border-neutral-300 grid place-content-center">
                {companyImage?.url && <Image src={companyImage.url} alt={event.companies?.company_name || "ukjent"} width={200} height={200} />}
              </div>
            </div>
            <div className="bg-zinc-100 rounded-b-xl px-8 pb-8">
              <SanitizeHtml html={event.companies?.description ?? ""} className="prose-lg" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {event.organizers
              .sort((a, b) => {
                if (a.role === 'main' && b.role !== 'main') return -1;
                if (a.role !== 'main' && b.role === 'main') return 1;
                return 0;
              })
              .map((organizer) => organizer.role === "main" ? (
                <div key={organizer.user_id}>
                  <div className="relative aspect-square w-full max-h-36">
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-transparent"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-zinc-100 rounded-t-xl"></div>
                    <div className="absolute inset-8 rounded-full bg-transparent grid place-content-center">
                      <img src={organizer.user.imageUrl} alt={organizer.user.fullName || "ukjent"} className="rounded-full h-full w-full" />
                    </div>
                  </div>
                  <div className="bg-zinc-100 rounded-b-xl px-8 pt-2 pb-8">
                    <div className="flex flex-col gap-4 items-center">
                      <div>
                        <p className="text-lg font-semibold">Hovedansvarlig</p>
                        <p>
                          {organizer.user.fullName}
                        </p>
                      </div>
                      <Button asChild className="w-1/2">
                        <a href={`mailto:${organizer.user.primaryEmailAddress?.emailAddress}`}>Ta kontakt</a>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={organizer.user_id} className="bg-zinc-100 px-6 py-4 flex flex-wrap gap-4 rounded-xl">
                  <img src={organizer.user.imageUrl} alt={organizer.user.fullName || "ukjent"} className="aspect-square rounded-full max-h-24 max-w-24" />
                  <div className="flex flex-col justify-between">
                    <div>
                      <p className="text-lg font-semibold">Medhjelper</p>
                      <p>
                        {organizer.user.fullName}
                      </p>
                    </div>
                    <Button asChild>
                      <a href={`mailto:${organizer.user.primaryEmailAddress?.emailAddress}`}>Ta kontakt</a>
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
