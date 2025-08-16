import { api } from "@workspace/backend/convex/api";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import { getAuthToken } from "@/utils/authToken";

export default async function Points({ className }: { className?: string }) {
	const token = await getAuthToken();
	const points = await fetchQuery(api.points.getCurrentStudentsPoints, {}, { token });

	const numberOfPoints = points.reduce((acc, point) => acc + point.severity, 0);

	return (
		<div
			className={cn(
				"grid gap-4 rounded-lg border border-primary/20 px-8 py-10 shadow-sm",
				className,
			)}
		>
			<div className='grid gap-6'>
				<div className='flex w-full justify-center gap-4'>
					{Array.from({ length: 3 }).map((_, index) => {
						const idx = index + 1;
						return (
							<div
								key={`point-${idx}`}
								className={`aspect-square h-full min-h-16 w-full max-w-16 rounded-full ${idx <= numberOfPoints ? "bg-primary" : "bg-zinc-300/50"}`}
							/>
						);
					})}
				</div>
				<p className='text-sm text-zinc-600 tracking-normal'>
					{numberOfPoints === 0
						? "Du er kjempe flink! Du har ingen poeng. Fortsett slik."
						: numberOfPoints === 1
							? "Hmm, du har ett poeng, men, men det er sånt som skjer, vi må bare ikke la det fortsette slik."
							: numberOfPoints === 2
								? "Huff! Dette er virkelig ikke bra, du har 2 poeng. Ett poeng til og du vil ikke ha muligheten til å melde deg på bedriftspresentasjoner igjen!"
								: `Uff! Dette er vrikelig ikke bra. Du har fått ${numberOfPoints} poeng. Dette vil medføre at du ikke kan melde deg på arrangementer.`}
				</p>
			</div>
			<p className='text-balance font-semibold text-lg text-primary tracking-tight'>
				Ved tre prikker får du ikke mulighet til å melde deg på bedriftspresentasjoner i en måned
			</p>
			<p className='text-balance font-semibold text-lg text-primary tracking-tight'>
				Navet har innført et prikksystem fordi sen eller manglende avmelding kan hindre andre
				studenter i å delta på bedriftspresentasjoner.
			</p>
			<div className='grid gap-4'>
				<p className='text-pretty font-semibold text-primary'>Slik fungerer systemet:</p>
				<p>Avmedlingsfrist er 24 timer før arrangemenet starter.</p>

				<div>
					<p>Automatiske prikker:</p>
					<ul className='grid gap-2'>
						<li>1. prikk - Sen avmelding</li>
						<li>1. prikk - Sen oppmøte til arrangmenetet</li>
						<li>2. prikker - Ikke møtt opp uten å melde seg av.</li>
					</ul>
				</div>
			</div>
			<p className='text-balance font-semibold text-lg text-primary tracking-tight'>
				Du er selv ansvarlig for å forsikre deg om at du har blitt oppmøte registrert på
				arrangementene til Navet.
			</p>

			<p>
				Ved spørsmål kan du sende en epost til:{" "}
				<a
					href='mailto:arrangement@ifinavet.no'
					className='cursor-pointer text-primary hover:underline'
				>
					arrangement@ifinavet.no
				</a>
			</p>
		</div>
	);
}
