import { auth } from "@clerk/nextjs/server";
import { Button } from "@workspace/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import ContainerCard from "@/components/cards/container-card";
import LargeUserCard from "@/components/cards/large-user";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import SanitizeHtml from "@/components/common/sanitize-html";
import { Title } from "@/components/common/title";
import { Id } from "@workspace/backend/convex/dataModel";
import { fetchQuery, preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { api } from "@workspace/backend/convex/api";
import { EventMetadata } from "@/components/events/event-metadata";
import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: Id<"events"> }> }): Promise<Metadata> {
  const { slug: eventId } = await params;
  const event = await fetchQuery(api.events.getById, { id: eventId })
  const company = await fetchQuery(api.companies.getById, { id: event.hostingCompany })

  return {
    openGraph: {
      images: [
        {
          url: company.imageUrl,
          secureUrl: company.imageUrl,
          type: "image/*",
          alt: company.name,
        }
      ]
    },
    title: event.title,
    description: event.teaser,
  }
}

export default async function EventPage({ params }: { params: Promise<{ slug: Id<"events"> }> }) {
  const eventId = (await params).slug;

  const { orgId } = await auth();

  const preloadedEvent = await preloadQuery(api.events.getById, { id: eventId })
  const event = preloadedQueryResult(preloadedEvent)

  const company = await fetchQuery(api.companies.getById, { id: event.hostingCompany })

  const preloadedRegistrations = await preloadQuery(api.registration.getByEventId, { eventId });

  return (
    <ResponsiveCenterContainer>
      <Title>{event.title}</Title>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-5'>
        <main className='gap-4 md:col-span-3'>
          <EventMetadata preloadedEvent={preloadedEvent} preloadedRegistrations={preloadedRegistrations} />
          <ContainerCard>
            <h1 className='scroll-m-20 text-balance pb-2 font-bold text-3xl tracking-normal'>
              {event.teaser}
            </h1>
            <SanitizeHtml html={event.description} className='prose' />
          </ContainerCard>
        </main>
        <aside className='flex flex-col gap-8 md:col-span-2'>
          <div>
            <div className='relative aspect-square w-full'>
              <div className='absolute top-0 left-0 h-1/2 w-full bg-transparent'></div>
              <div className='absolute bottom-0 left-0 h-1/2 w-full rounded-t-xl bg-zinc-100'></div>
              <div className='absolute inset-12 grid place-content-center rounded-full border-2 border-neutral-300 bg-white'>
                {company.imageUrl && (
                  <Image
                    src={company.imageUrl}
                    alt={event.hostingCompanyName}
                    fill
                    sizes="50vw"
                    className='object-contain p-8 sm:p-18 md:p-10 lg:p-16'
                    loading='eager'
                  />)}
              </div>
            </div>
            <div className='rounded-b-xl bg-zinc-100 px-8 pb-8'>
              <SanitizeHtml html={company.description} className='prose-lg' />
            </div>
          </div>
          <div className='grid grid-cols-1 gap-4'>
            {event.organizers
              .sort((a, b) => {
                if (a.role === "hovedansvarlig" && b.role !== "hovedansvarlig") return -1;
                if (a.role !== "hovedansvarlig" && b.role === "hovedansvarlig") return 1;
                return 0;
              })
              .map((organizer) =>
                organizer.role === "hovedansvarlig" ? (
                  <LargeUserCard
                    title='Hovedansvarlig'
                    key={organizer.id}
                    fullName={organizer.name}
                    imageUrl={organizer.imageUrl}
                    email={organizer.email}
                  />
                ) : (
                  <div
                    key={organizer.id}
                    className='flex flex-wrap items-center gap-4 rounded-xl bg-zinc-100 px-6 py-4'
                  >
                    <img
                      src={organizer.imageUrl}
                      alt={organizer.name}
                      className='aspect-square max-h-16 max-w-16 rounded-full'
                      loading='lazy'
                    />
                    <div className='flex flex-col justify-between'>
                      <div>
                        <p className='font-semibold text-lg'>Medhjelper</p>
                        <p>{organizer.name}</p>
                      </div>
                      <Button asChild>
                        <a
                          href={`mailto:${organizer.email}`}
                          rel='noopener'
                          target='_blank'
                        >
                          Ta kontakt
                        </a>
                      </Button>
                    </div>
                  </div>
                ),
              )}
          </div>
          {orgId === process.env.NAVET_ORG_ID && (
            <Button
              variant={"outline"}
              type='button'
              className='h-18 rounded-xl border-primary font-semibold text-lg text-primary'
              asChild
            >
              <Link href={`/events/${eventId}/admin`}>Administer arrangementet</Link>
            </Button>
          )}
        </aside>
      </div>
    </ResponsiveCenterContainer>
  );
}
