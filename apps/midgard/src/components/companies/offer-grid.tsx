import { cn } from "@workspace/ui/lib/utils";

export default function OfferGrid({ className }: { className?: string }) {
	return (
		<div className={cn(className, "grid grid-cols-1 gap-6 md:grid-cols-2")}>
			<OfferCard title='Stor bedriftspresentasjon' cost='40.000'>
				<li>
					En større bedriftspresentasjon holdes enten ved IFI eller i deres egne lokaler. Dere
					velger ønsket antall studenter selv, uten begrensninger.
				</li>
				<li>
					Dere bestemmer selv innholdet og vi kan rådføre ved behov. Vanligvis holder bedriften
					presentasjon i 45-60 minutter, før vi går videre til mingling, mat og drikke.
				</li>
			</OfferCard>
			<OfferCard title='Ordniær bedriftspresentasjon' cost='30.000'>
				<li>
					Her gjelder samme vilkår som ved stor bedriftspresentasjon, men med en antallsbegrensing
					på 40 studenter.
				</li>
			</OfferCard>
			<OfferCard title='Bedriftspresentasjon med fokus på faglig innhold' cost='20.000'>
				<li>
					Denne typen presentasjon har en satt begrensning på maks 10 minutter presentasjon,
					etterfulgt av annet faglig innhold, eventuelt workshop.
				</li>
				<li>
					Varighet for arrangementet avhenger av hva dere ønsker å gjennomføre. Av erfaring bør
					dette ikke vare særlig mer enn 1,5 time uten å ha noen form for matservering underveis.
					Dere står fritt til å velge innhold selv og gi gjerne en beskrivelse av hva dere ønsker å
					gjennomføre i søknaden deres. Maks 40 studenter.
				</li>
			</OfferCard>
			<OfferCard title='Eksterne arrangementer' cost='20.000'>
				<li>
					Eksterne arrangementer er aktiviteter gjennomført og organisert av bedriften uavhengig av
					Navet. Promotering vil skje via ifinavet.no under fanen "Eksterne arrangementer" og på
					Instagram hvor dere vil få to storyer.
				</li>
				<li>
					Det at arrangementet er uavhengig av Navet betyr at Navet kun stiller med promotering av
					arrangementet. Navet deltar ikke i organiseringen eller påmelding av arrangementet,
					aktiviteten skal ikke ta plass på IFI, det kan ikke foregå på tirsdager og torsdager og
					arrangementet kan ikke etterligne det en bedriftspresentasjon tilbyr for studenter.
				</li>
				<li>
					Navet forebeholder seg retten til å avslå alle forespørsler om promotering av eksterne
					arrangementer. Skjema for eksterne arrangementer
				</li>
			</OfferCard>
		</div>
	);
}

function OfferCard({
	title,
	cost,
	children,
}: {
	title: string;
	cost: string;
	children: React.ReactNode;
}) {
	return (
		<div className='overflow-clip rounded-lg bg-white shadow-md'>
			<div className='flex h-48 flex-col justify-between bg-primary p-8 text-primary-foreground'>
				<h3 className='max-w-3/4 font-semibold text-2xl'>{title}</h3>
				<p className=''>Kostnad: {cost} NOK eks. mva.</p>
			</div>
			<div className='max-w-[80ch] p-6'>
				<ul className='my-6 ml-6 list-disc [&>li]:mt-2 [&>li]:leading-7'>{children}</ul>
			</div>
		</div>
	);
}
