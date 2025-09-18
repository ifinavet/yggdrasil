import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

export default function JobListingBanner({ className }: { className?: string }) {
	return (
		<div className={cn(className, "-mb-12 relative w-full")}>
			<div
				className="pointer-events-none absolute inset-0 bg-[url(/Ns.svg)] bg-center bg-cover dark:opacity-30"
				aria-hidden="true"
			/>
			<div className="relative z-10">
				<div className="mx-auto flex max-w-6xl flex-col items-center justify-between px-8 py-12 md:gap-12 lg:flex-row">
					<div className="flex max-w-[70ch] flex-col gap-4">
						<h3 className="scroll-m-20 font-semibold text-2xl text-primary tracking-tight dark:text-primary-foreground">
							Ønsker du å legge ut stillingsannonser på våre nettsider?
						</h3>
						<p className="text-primary dark:text-primary-foreground">
							Navet tilbyr publisering av stillingsannonser på våre hjemmesider. Dette gjelder både
							interships, deltid-, og fulltidsstillinger. Ved forespørsel om annonser for sommerjobb
							er det viktig at de følger{" "}
							<a
								href="https://drive.google.com/file/d/1wW0356QeoPGtKQruSlP8eBXI7qqn8eHm/view?usp=sharing"
								rel="nofollow noopener noreferrer external"
								target="_blank"
								className="hover:cursor underline"
							>
								FIFs retningslinjer.{" "}
							</a>
							Alle annonser er nødt til å følge{" "}
							<a
								href="https://drive.google.com/file/d/1h4AuNXJ4LFfrrCAdN_anFu7o1F56Q1hx/view"
								rel="nofollow noopener noreferrer external"
								target="_blank"
								className="hover:cursor underline"
							>
								Navet's retningslinjer.
							</a>
							<br />
							<br />
							Stillingsannonser må inneholde en søknadsfrist og stillingen må være relatert til
							informatikk. Nye annonser publiseres ukentlig. Følg linken for å opprette
							stillingsannonse:
						</p>
					</div>
					<Button
						className="px-18 py-6 text-primary-foreground dark:bg-primary-light dark:text-primary"
						asChild
					>
						<a
							href="https://docs.google.com/forms/d/1pyPhN0eod6g3iwmHLfUycz1CI2KplwZRSbozwrJdaR4/edit"
							rel="nofollow noopener noreferrer external"
							target="_blank"
						>
							Skjema for stillingsannonse
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
}
