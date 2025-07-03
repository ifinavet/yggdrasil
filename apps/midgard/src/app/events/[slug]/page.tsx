import { auth } from "@clerk/nextjs/server";
import { Button } from "@workspace/ui/components/button";
import { CalendarDays, Globe, IdCard, MapPin, Users, Utensils } from "lucide-react";
import Image from "next/image";
import SanitizeHtml from "@/components/common/sanitize-html";
import RegistrationButton from "@/components/events/registration/registration-button";
import getCompanyImageById from "@/lib/query/companies/getById";
import { getEventById } from "@/lib/query/events";
import { humanReadableDateTime } from "@/uitls/dateFormatting";
import Link from "next/link";

export default async function EventPage({ params }: { params: Promise<{ slug: number }> }) {
  const { userId, orgId } = await auth();
  const event_id = (await params).slug;

  const event = await getEventById(event_id);

  if (!event || !event.event_id || !event.company_id) {
    return <div>Event not found</div>;
  }

  const companyImage = await getCompanyImageById(event.company_id);

  const userRegistration = event.registrations.find(
    (registration) => registration.user_id === userId,
  );

  const participantsLimit = event.participants_limit;
  const participants = event.registrations_by_status?.["registered"]?.length || 0;
  const availableSpots = participantsLimit - participants;

  return (
    <div className='mx-6 md:mx-auto md:w-5/6 lg:w-4/5 xl:w-8/14'>
      <h1 className='mb-4 scroll-m-20 text-balance border-primary border-b-2 pb-2 text-center font-extrabold text-4xl text-primary tracking-tight md:text-5xl'>
        {event.title}
      </h1>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-5'>
        <main className='gap-4 md:col-span-3'>
          <div>
            <div className='grid h-80 grid-cols-2 grid-rows-3 items-center justify-start rounded-xl bg-primary px-10 py-6 text-primary-foreground md:px-16 md:py-8'>
              <p className='flex items-center gap-2 font-semibold md:text-lg'>
                <CalendarDays className='size-8' />{" "}
                {humanReadableDateTime(new Date(event?.event_start || ""))}
              </p>
              <p className='flex items-center gap-2 font-semibold md:text-lg'>
                <MapPin className='size-8' /> {event.location}
              </p>
              <p className='flex items-center gap-2 font-semibold md:text-lg'>
                <Utensils className='size-8' /> {event.food}
              </p>
              <p className='flex items-center gap-2 font-semibold md:text-lg'>
                <Users className='size-8' /> {availableSpots} plasser igjen
              </p>
              <p className='flex items-center gap-2 font-semibold md:text-lg'>
                <Globe className='size-8' /> {event.language}
              </p>
              <p className='flex items-center gap-2 font-semibold md:text-lg'>
                <IdCard className='size-8' /> {event.age_restrictions}
              </p>
            </div>
            <div className='-mt-8 mb-8 flex justify-center'>
              <RegistrationButton
                event_id={event.event_id}
                userRegistration={userRegistration}
                availableSpots={availableSpots}
              />
            </div>
          </div>
          <div className='flex flex-col gap-4 rounded-xl bg-zinc-100 px-10 py-8 md:px-12'>
            <h1 className='scroll-m-20 text-balance pb-2 font-bold text-3xl tracking-normal'>
              {event.teaser}
            </h1>
            <SanitizeHtml html={event.description ?? ""} className='prose' />
          </div>
        </main>
        <aside className='flex flex-col gap-8 md:col-span-2'>
          <div>
            <div className='relative aspect-square w-full'>
              <div className='absolute top-0 left-0 h-1/2 w-full bg-transparent'></div>
              <div className='absolute bottom-0 left-0 h-1/2 w-full rounded-t-xl bg-zinc-100'></div>
              <div className='absolute inset-12 grid place-content-center rounded-full border-2 border-neutral-300 bg-white'>
                {companyImage?.url && (
                  <Image
                    src={companyImage.url}
                    alt={event.companies?.company_name || "ukjent"}
                    width={200}
                    height={200}
                    className="p-4"
                    loading="eager"
                  />
                )}
              </div>
            </div>
            <div className='rounded-b-xl bg-zinc-100 px-8 pb-8'>
              <SanitizeHtml html={event.companies?.description ?? ""} className='prose-lg' />
            </div>
          </div>
          <div className='grid grid-cols-1 gap-4'>
            {event.organizers
              .sort((a, b) => {
                if (a.role === "main" && b.role !== "main") return -1;
                if (a.role !== "main" && b.role === "main") return 1;
                return 0;
              })
              .map((organizer) =>
                organizer.role === "main" ? (
                  <div key={organizer.user_id}>
                    <div className='relative aspect-square max-h-36 w-full'>
                      <div className='absolute top-0 left-0 h-1/2 w-full bg-transparent'></div>
                      <div className='absolute bottom-0 left-0 h-1/2 w-full rounded-t-xl bg-zinc-100'></div>
                      <div className='absolute inset-8 grid place-content-center rounded-full bg-transparent'>
                        <img
                          src={organizer.user.imageUrl}
                          alt={organizer.user.fullName || "ukjent"}
                          className='h-full w-full rounded-full'
                        />
                      </div>
                    </div>
                    <div className='rounded-b-xl bg-zinc-100 px-8 pt-2 pb-8'>
                      <div className='flex flex-col items-center gap-4'>
                        <div>
                          <p className='font-semibold text-lg'>Hovedansvarlig</p>
                          <p>{organizer.user.fullName}</p>
                        </div>
                        <Button asChild className='w-1/2'>
                          <a href={`mailto:${organizer.user.primaryEmailAddress?.emailAddress}`}>
                            Ta kontakt
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={organizer.user_id}
                    className='flex flex-wrap gap-4 rounded-xl bg-zinc-100 px-6 py-4'
                  >
                    <img
                      src={organizer.user.imageUrl}
                      alt={organizer.user.fullName || "ukjent"}
                      className='aspect-square max-h-24 max-w-24 rounded-full'
                      loading="lazy"
                    />
                    <div className='flex flex-col justify-between'>
                      <div>
                        <p className='font-semibold text-lg'>Medhjelper</p>
                        <p>{organizer.user.fullName}</p>
                      </div>
                      <Button asChild>
                        <a href={`mailto:${organizer.user.primaryEmailAddress?.emailAddress}`}>
                          Ta kontakt
                        </a>
                      </Button>
                    </div>
                  </div>
                ),
              )}
          </div>
          {orgId === process.env.NAVET_ORG_ID && (
            <Button variant={"outline"} type="button" className="h-18 rounded-xl" asChild>
              <Link href={`/events/${event_id}/admin`}>
                Administer arrangementet
              </Link>
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
