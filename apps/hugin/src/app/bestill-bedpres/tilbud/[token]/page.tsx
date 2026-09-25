import { api } from "@workspace/backend/convex/api";
import { preloadQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CompanyOffer } from "@/components/company-offer/company-offer";
import { COMPANY_OFFER_COPY } from "@/lib/company-offer-copy";

export const metadata: Metadata = {
	title: "Tilbud om bedriftsarrangement",
	// The token in the address is the only credential: keep it out of search engines and referrers.
	// Analytics and Sentry skip this page too; see lib/private-paths.ts.
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};

// Shown behind the semester planning gate, which only renders in the browser.
export const instant = false;

export default function CompanyOfferPage({
	params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
	return (
		<Suspense
			fallback={
				<p className="mx-auto max-w-lg px-4 py-10 text-muted-foreground">
					{COMPANY_OFFER_COPY.loading}
				</p>
			}
		>
			<LoadedCompanyOffer params={params} />
		</Suspense>
	);
}

async function LoadedCompanyOffer({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
	const { token } = await params;
	const preloadedOffer = await preloadQuery(api.semesterPlanning.offers.queries.getByToken, {
		token,
	});

	return <CompanyOffer token={token} preloadedOffer={preloadedOffer} />;
}
