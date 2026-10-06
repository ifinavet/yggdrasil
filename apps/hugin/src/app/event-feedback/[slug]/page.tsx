import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Tilbakemeldingsskjemaet er stengt",
	robots: { index: false, follow: false },
};

export default function ClosedEventFeedbackPage() {
	return (
		<main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 p-6">
			<h1 className="font-bold text-2xl">Tilbakemeldingsskjemaet er stengt</h1>
			<p className="text-muted-foreground">
				Dette tilbakemeldingsskjemaet er stengt. Nye lenker til tilbakemelding kommer på e-post.
			</p>
			<Link href="/" className="text-primary underline">
				Gå til forsiden
			</Link>
		</main>
	);
}
