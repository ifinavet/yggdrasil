import { Button } from "@workspace/ui/components/button";
import { Home } from "lucide-react";
import Link from "next/link";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";

export default function NotFound() {
	return (
		<ResponsiveCenterContainer className="text-center">
			<div className="mx-auto w-full max-w-xl">
				<div className="mb-6 inline-flex items-center rounded-full border px-3 py-1 text-muted-foreground text-xs">
					<span className="mr-2 inline-flex h-2 w-2 rounded-full bg-destructive" /> Feil 404
				</div>

				<h1 className="mb-3 font-bold text-4xl tracking-tight sm:text-5xl">
					Oisann! Siden ble ikke funnet.
				</h1>

				<p className="mb-8 text-balance text-muted-foreground">
					Siden du leter etter finnes ikke, kan ha blitt flyttet eller er midlertidig utilgjengelig.
					Sjekk nettadressen, eller gå videre med et av valgene under.
				</p>

				<div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
					<Button asChild className="text-primary-foreground">
						<Link href="/">
							<Home className="mr-2 size-4" />
							Gå til forsiden
						</Link>
					</Button>
				</div>

				<div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="rounded-lg border p-4 text-left">
						<h3 className="mb-1 font-semibold">Sjekk URL</h3>
						<p className="text-muted-foreground text-sm">
							Vennligst kontroller at nettadressen er skrevet riktig.
						</p>
					</div>
					<div className="rounded-lg border p-4 text-left">
						<h3 className="mb-1 font-semibold">Gå til forsiden</h3>
						<p className="text-muted-foreground text-sm">
							Finn det du trenger fra forsiden eller toppmenyen.
						</p>
					</div>
					<div className="rounded-lg border p-4 text-left">
						<h3 className="mb-1 font-semibold">Kontakt oss</h3>
						<p className="text-muted-foreground text-sm">
							Trenger du hjelp? Ta kontakt med support hvis problemet vedvarer.
						</p>
						<a className="text-muted-foreground text-sm italic" href="mailto:web@ifinavet.no">
							Send oss en mail
						</a>
					</div>
				</div>
			</div>
		</ResponsiveCenterContainer>
	);
}
