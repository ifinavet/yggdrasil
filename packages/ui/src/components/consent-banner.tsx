import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";

/**
 * The cookie consent card shown at the bottom of Midgard and Hugin until the visitor answers.
 * Compact on phones, so it does not hide the page or a sticky action bar behind it.
 */
export function ConsentBanner({
	onAccept,
	onDecline,
}: Readonly<{ onAccept: () => void; onDecline: () => void }>) {
	return (
		<section
			aria-labelledby="consent-banner-title"
			className="fixed right-0 bottom-0 left-0 z-50 px-2 pb-[max(8px,env(safe-area-inset-bottom))] md:px-6 md:pb-6"
		>
			<Card className="wrap-break-word max-h-[60svh] w-full max-w-xl gap-0 overflow-y-auto text-pretty border-primary p-4 shadow-lg md:p-6">
				<h2
					id="consent-banner-title"
					className="m-0 font-semibold text-[15px] leading-snug md:text-base"
				>
					Hjelp oss med å gjøre ifinavet.no best mulig
				</h2>
				<p className="m-0 mt-1 text-[13px] text-muted-foreground leading-normal md:mt-1.5 md:text-sm">
					Vi bruker informasjonskapsler (cookies) til å forbedre og forstå hvordan nettsiden vår
					brukes.
					<span className="hidden md:inline">
						{" "}
						Vi bruker kun informasjonen lokalt, og deler den aldri med noen tredjeparter.
					</span>
				</p>
				<div className="mt-3 grid grid-cols-2 gap-2 md:mt-5 md:flex md:flex-wrap md:gap-4">
					<Button onClick={onAccept} className="min-h-11 text-primary-foreground">
						<span className="md:hidden">Godta</span>
						<span className="hidden md:inline">Godta bruk av cookies</span>
					</Button>
					<Button onClick={onDecline} variant="secondary" className="min-h-11">
						<span className="md:hidden">Avslå</span>
						<span className="hidden md:inline">Avslå bruk av cookies</span>
					</Button>
				</div>
			</Card>
		</section>
	);
}
