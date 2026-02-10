import { Suspense } from "react";
import { EventResponseFrom } from "./form";

export default function EventResponse() {
	const company = "bedrift";

	return (
		<div className="mx-auto mb-8 max-w-3xl">
			<div className="prose dark:prose-invert max-w-[80ch] pb-4 prose-h1:text-primary dark:prose-h1:text-primary-foreground">
				<h1>Bedriftspresentasjon med {company}</h1>
				<p>
					Takk for at du kom på Bedriftspresentasjonen vår. Vi ønsker alltid å gjøre opplevelsen
					best mulig. Derfor så hadde vi satt pris på om du kunne svart på denne kjappe
					undersøkelsen.
				</p>
			</div>

			<Suspense>
				<EventResponseFrom />
			</Suspense>
		</div>
	);
}
