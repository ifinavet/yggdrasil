import { Button } from "@workspace/ui/components/button";
import { Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { FacebookIcon, InstagramIcon, LinkedinIcon } from "@/assets/icons/social";
import Navet_Logo from "@/assets/navet/logo_n_blaa.webp";
import Navet from "@/assets/promo_images/navet.webp";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import TwoColumns from "@/components/common/two-columns";
import EventsCarousel from "@/components/home/events-carousel";
import JobListings from "@/components/home/job-listings";
import MainSponsorCard from "@/components/home/main-sponsor";
import EventsCarouselSkeleton from "@/components/loaders/home/events-carousel-skeleton";
import JobListingsSkeleton from "@/components/loaders/home/job-listings-skeleton";
import MainSponsorCardSkeleton from "@/components/loaders/home/main-sponsor-skeleton";

export default function HomePage() {
	return (
		<div className='grid gap-8'>
			{/* Welcome banner for the new website, remove at the end of august. */}
			{/*<div className='-mt-8 text-pretty bg-primary-light py-4 text-center font-semibold text-lg text-primary dark:text-primary-foreground'>
				<Link
					href='/info/velkommen-til-den-nye-navet-siden!'
					className='whitespace-normal text-pretty hover:cursor-pointer hover:underline'
				>
					Velkommen til Navets nye nettside! For mer informasjon, trykk her!
				</Link>
			</div>/*}
			{/* Welcome banner for the new website, remove at the end of august. */}

			<ResponsiveCenterContainer>
				<div className='grid justify-center gap-8 md:grid-cols-2'>
					<Suspense fallback={<MainSponsorCardSkeleton />}>
						<MainSponsorCard />
					</Suspense>
					<Suspense fallback={<EventsCarouselSkeleton />}>
						<EventsCarousel />
					</Suspense>
				</div>
			</ResponsiveCenterContainer>

			<Suspense fallback={<JobListingsSkeleton />}>
				<JobListings />
			</Suspense>

			<ResponsiveCenterContainer>
				<TwoColumns
					className='!gap-2'
					main={
						<div>
							<h3 className='scroll-m-20 font-semibold text-3xl text-primary tracking-tight dark:text-primary-foreground'>
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
									className='flex items-center gap-2 text-lg text-primary underline dark:text-primary-foreground'
								>
									<InstagramIcon className='size-4 fill-primary dark:fill-primary-foreground' />{" "}
									Instagram
								</a>
								<a
									href='https://www.facebook.com/share/1C1q1rEvmL/?mibextid=wwXIfr'
									rel='nofollow noopener noreferrer external'
									target='_blank'
									className='flex items-center gap-2 text-lg text-primary underline dark:text-primary-foreground'
								>
									<FacebookIcon className='size-4 fill-primary dark:fill-primary-foreground' />{" "}
									Facebook
								</a>
								<a
									href='https://ie.linkedin.com/company/ifinavet'
									rel='nofollow noopener noreferrer external'
									target='_blank'
									className='flex items-center gap-2 text-lg text-primary underline dark:text-primary-foreground'
								>
									<LinkedinIcon className="size-4 text-primary dark:fill-primary" />
									Linkedin
								</a>
							</div>
						</div>
					}
					aside={
						<div className='relative mx-auto h-[280px] w-[280px] max-w-full sm:h-[350px] sm:w-[350px] md:h-[420px] md:w-[420px]'>
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
