import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

export default function JobListingBanner({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				className,
				"-mb-12 flex flex-col items-center justify-between bg-[url(/Ns.svg)] px-8 py-12 md:gap-12 lg:mx-auto lg:flex-row",
			)}
		>
			<div className='flex max-w-[70ch] flex-col gap-4'>
				<h3 className='scroll-m-20 font-semibold text-2xl text-primary tracking-tight'>
					Ønsker du å legge ut stillingsannonser på våre nettsider?
				</h3>
				<p className='text-primary'>
					Navet tilbyr publisering av stillingsannonser på våre hjemmesider. Dette gjelder både
					interships, deltid-, og fulltidsstillinger. Ved forespørsel om annonser for sommerjobb er
					det viktig at de følger FIFs retningslinjer. Alle annonser er nødt til å følge Navet's
					retningslinjer.
					<br />
					<br />
					Stillingsannonser må inneholde en søknadsfrist og stillingen må være relatert til
					informatikk. Nye annonser publiseres ukentlig. Følg linken for å opprette
					stillingsannonse:
				</p>
			</div>
			<Button className='px-18 py-6' asChild>
				<a
					href='https://docs.google.com/forms/d/1pyPhN0eod6g3iwmHLfUycz1CI2KplwZRSbozwrJdaR4/edit'
					target='_blank'
					rel='noopener noreferrer'
				>
					Skjema for stillingsannonse
				</a>
			</Button>
		</div>
	);
}
