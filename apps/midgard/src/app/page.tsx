import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@workspace/ui/components/carousel";
import { fetchQuery } from "convex/nextjs";
import Image from "next/image";
import Link from "next/link";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import SafeHtml from "@/components/common/sanitize-html";
import EventCard from "@/components/events/event-card";
import JobListingCard from "@/components/job-listings/job-listing-card";

export const dynamic = "force-dynamic";

export default async function MainPage() {
  const latestEvents = await fetchQuery(api.events.getLatest, { n: 3 });
  const mainSponsor = await fetchQuery(api.companies.getMainSponsor);
  const jobListings = await fetchQuery(api.listings.getAll, { n: 3 });

  return (
    <div className='grid gap-8'>
      <ResponsiveCenterContainer>
        <div className='grid gap-8 md:grid-cols-2'>
          {mainSponsor && (
            <div className='lg:-ml-24 order-2 space-y-6 md:order-1'>
              <h1 className='hyphens-manual text-balance font-bold text-4xl text-primary tracking-tight'>
                Hoved&shy;samarbeids&shy;partner
              </h1>
              <div className='flex flex-col items-center gap-6 rounded-xl bg-primary-light px-4 py-16 md:flex-row md:px-8'>
                <div className='grid aspect-square h-32 place-content-center rounded-full border-2 border-neutral-300 bg-white'>
                  {mainSponsor?.imageUrl && (
                    <Image
                      src={mainSponsor.imageUrl}
                      alt={mainSponsor.name}
                      width={200}
                      height={200}
                      className='h-auto p-8'
                      loading='eager'
                    />
                  )}
                </div>
                <div className='flex h-full flex-col justify-start gap-2'>
                  <h1 className='font-bold text-4xl text-primary'>{mainSponsor?.name}</h1>
                  <SafeHtml html={mainSponsor?.description || ""} className='prose text-primary' />
                </div>
              </div>
            </div>
          )}
          {latestEvents.length > 0 && (
            <div className='order-1 grid justify-center gap-2 md:order-2'>
              <Carousel className='w-full max-w-64 md:max-w-96'>
                <CarouselContent>
                  {latestEvents.map((event) => (
                    <CarouselItem key={event._id}>
                      <div className='p-1'>
                        <EventCard event={event} />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
              <Button asChild className='mx-8 bg-emerald-600 py-6 font-semibold hover:bg-emerald-700'>
                <Link href={"/events"}>Se alle arrangementer</Link>
              </Button>
            </div>
          )}
        </div>
      </ResponsiveCenterContainer>
      <div className='h-full bg-[url(/Ns.svg)] py-16'>
        <ResponsiveCenterContainer className='space-y-6'>
          <h1 className='font-bold text-4xl text-primary'>Stillingsannonser</h1>
          <div className='flex flex-col items-center justify-evenly gap-6 md:flex-row'>
            {jobListings.map((listing) => (
              <JobListingCard
                key={listing._id}
                title={listing.title}
                listingId={listing._id}
                type={listing.type}
                companyName={listing.companyName}
                teaser={listing.teaser}
                image={listing.companyLogo}
              />
            ))}
          </div>
          <div className='flex justify-center'>
            <Button
              asChild
              className='mx-8 bg-emerald-600 py-6 font-semibold hover:bg-emerald-700 md:w-1/3'
            >
              <Link href={"/job-listings"}>Se alle stillingsannonser</Link>
            </Button>
          </div>
        </ResponsiveCenterContainer>
      </div>
    </div>
  );
}
