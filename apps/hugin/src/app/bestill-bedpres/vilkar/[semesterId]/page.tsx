import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { isMissingDocumentError } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { fetchQuery } from "convex/nextjs";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Standardvilkår" };

// Shown behind the semester planning gate, which only renders in the browser.
export const instant = false;

/** A semester's standard terms: the PDF uploaded in Bifrost, shown in the browser's PDF viewer. */
export default function TermsPage({
	params,
}: Readonly<{ params: Promise<{ semesterId: string }> }>) {
	return (
		<div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4">
			<Suspense>
				<LoadedTerms params={params} />
			</Suspense>
		</div>
	);
}

async function LoadedTerms({ params }: Readonly<{ params: Promise<{ semesterId: string }> }>) {
	const { semesterId } = await params;
	let terms: Awaited<ReturnType<typeof fetchTerms>>;
	try {
		terms = await fetchTerms(semesterId);
	} catch (error) {
		if (isMissingDocumentError(error)) notFound();
		throw error;
	}
	if (!terms) notFound();

	return (
		<>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="font-semibold text-2xl">Standardvilkår for {terms.name.toLowerCase()}</h1>
				<Button asChild variant="outline">
					<a href={terms.url} download>
						<Download /> Last ned PDF
					</a>
				</Button>
			</div>
			<object
				data={terms.url}
				type="application/pdf"
				aria-label="Standardvilkår"
				className="h-[80vh] w-full rounded-lg border"
			>
				<p className="p-4">
					Nettleseren kan ikke vise PDF-en her.{" "}
					<a href={terms.url} className="underline">
						Åpne standardvilkårene
					</a>
					.
				</p>
			</object>
		</>
	);
}

function fetchTerms(semesterId: string) {
	return fetchQuery(api.semesterPlanning.semesters.queries.terms, {
		semesterId: semesterId as Id<"semesters">,
	});
}
