"use client";
import { Button } from "@workspace/ui/components/button";
export default function WikiError({ reset }: Readonly<{ reset: () => void }>) {
	return (
		<section role="alert" className="rounded-lg border p-6">
			<h1 className="font-semibold text-xl">Håndboken kunne ikke lastes</h1>
			<p className="my-3 text-muted-foreground">
				Innhold og oppdaterte fakta er utilgjengelige akkurat nå. Prøv igjen når forbindelsen er
				tilbake.
			</p>
			<Button variant="outline" onClick={reset}>
				Prøv igjen
			</Button>
		</section>
	);
}
