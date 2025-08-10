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
import { Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FacebookIcon, InstagramIcon, LinkedinIcon } from "@/assets/icons/social";
import Navet_Logo from "@/assets/navet/logo_n_blaa.webp";
import Navet from "@/assets/promo_images/navet.webp";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import SafeHtml from "@/components/common/sanitize-html";
import TwoColumns from "@/components/common/two-columns";
import EventCard from "@/components/events/event-card";
import JobListingCard from "@/components/job-listings/job-listing-card";

export const dynamic = "force-dynamic";

export default async function MainPage() {
  const latestEvents = await fetchQuery(api.events.getLatest, { n: 3 });
  const mainSponsor = await fetchQuery(api.companies.getMainSponsor);
  const jobListings = await fetchQuery(api.listings.getAll, { n: 3 });

  return (
    <div className='grid gap-8'>
      {/* Welcome banner for the new website, remove at the end of august. */}
      <div className='-mt-8 text-pretty bg-primary-light py-4 text-center font-semibold text-lg text-primary'>
        <Link
          href='/info/velkommen-til-den-nye-navet-siden!'
          className="whitespace-normal text-pretty hover:cursor-pointer hover:underline"
        >
          Velkommen til Navets ny nettside! For mer informasjon, trykk her!
        </Link>
      </div>
      {/* Welcome banner for the new website, remove at the end of august. */}
      <ResponsiveCenterContainer>
        <div className='grid gap-8 md:grid-cols-2'>
          {mainSponsor && (
            <div
              className={`${latestEvents.length > 0 ? "lg:-ml-24 order-2 md:order-1" : "col-span-full mx-auto max-w-3xl"} space-y-6`}
            >
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
              <Button
                asChild
                className='mx-8 bg-emerald-600 py-6 font-semibold hover:bg-emerald-700'
              >
                <Link href={"/events"}>Se alle arrangementer</Link>
              </Button>
            </div>
          )}
        </div>
      </ResponsiveCenterContainer>
      {jobListings.length > 0 && (
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
      )}
      <ResponsiveCenterContainer>
        <TwoColumns
          main={
            <div>
              <h3 className='scroll-m-20 font-semibold text-3xl text-primary tracking-tight'>
                Hvem er vi?
              </h3>
              <p className='leading-7 [&:not(:first-child)]:mt-6'>
                Navet er bedriftskontakten ved Institutt for informatikk ved Universitetet i Oslo.
                Hensikten med Navet er å gjøre det enkelt for bedrifter å komme i kontakt med
                studentene ved instituttet, ved å tilby:
              </p>

              <ul className='my-6 ml-6 list-disc [&>li]:mt-2'>
                <li>
                  et sentralt kontakt- og koordineringspunkt for alle bedriftsrelaterte aktiviteter
                  ved instituttet.
                </li>
                <li>
                  praktisk hjelp ved bedriftspresentasjoner og andre typer arrangementer
                  (romreservasjon, matbestilling, mm.)
                </li>
                <li>oversikt over bredriftsrelaterte aktiviteter for studenter.</li>
              </ul>

              <h4 className='scroll-m-20 font-semibold text-xl tracking-tight'>
                Følg oss på sosiale medier!
              </h4>
              <div className='mt-4 flex gap-4'>
                <a
                  href='https://www.instagram.com/ifinavet/'
                  rel='nofollow noopener noreferrer external'
                  target='_blank'
                  className='flex items-center gap-2 text-lg text-primary underline'
                >
                  <InstagramIcon className='size-4 fill-primary' /> Instagram
                </a>
                <a
                  href='https://www.facebook.com/share/1C1q1rEvmL/?mibextid=wwXIfr'
                  rel='nofollow noopener noreferrer external'
                  target='_blank'
                  className='flex items-center gap-2 text-lg text-primary underline'
                >
                  <FacebookIcon className='size-4 fill-primary' /> Facebook
                </a>
                <a
                  href='https://ie.linkedin.com/company/ifinavet'
                  rel='nofollow noopener noreferrer external'
                  target='_blank'
                  className='flex items-center gap-2 text-lg text-primary underline'
                >
                  <LinkedinIcon className='size-4 text-primary' />
                  Linkedin
                </a>
              </div>
            </div>
          }
          aside={
            <div className='relative mx-auto h-[280px] w-[280px] sm:h-[350px] sm:w-[350px] md:h-[420px] md:w-[420px]'>
              <div className='absolute top-0 left-0 z-10 size-40 translate-x-4 translate-y-8 transform overflow-hidden rounded-full sm:size-48 md:size-56'>
                <Image
                  src={Navet}
                  alt='Vi alle elsker Navet'
                  className='h-full w-full bg-gray-200 object-cover'
                />
              </div>

              <div className='-translate-x-4 -translate-y-8 absolute right-0 bottom-0 z-0 size-40 transform overflow-hidden rounded-full sm:size-48 md:size-56'>
                <Image
                  src={Navet_Logo}
                  alt='Vi alle elsker Navet'
                  className='h-full w-full bg-gray-100 object-contain p-8'
                />
              </div>
            </div>
          }
        />
        <Button variant='outline' asChild>
          <Link href='/organization'>
            <Info />
            Les mer om Navet
          </Link>
        </Button>
      </ResponsiveCenterContainer>
    </div>
  );
}
