import { getAuthToken, hasEditRights } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { isMissingDocumentError } from "@workspace/shared/utils";
import { preloadQuery } from "convex/nextjs";
import type { Preloaded } from "convex/react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
	ApplicationPage,
	ApplicationSkeleton,
} from "@/components/semester-planning/application/application-page";

export const metadata: Metadata = {
	title: "Søknad",
};

// Shown behind the semester planning gate, which only renders in the browser.
export const instant = false;

export default function ApplicationRoute({
	params,
}: Readonly<{
	params: Promise<{ id: string }>;
}>) {
	// Rights, params and data need the request, so the page streams in behind a skeleton.
	return (
		<Suspense fallback={<ApplicationSkeleton />}>
			<LoadedApplication params={params} />
		</Suspense>
	);
}

async function LoadedApplication({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
	// Applications hold contact and invoice details, so only editors see them.
	if (!(await hasEditRights())) redirect("/semesterplan");

	const [{ id }, token] = await Promise.all([params, getAuthToken()]);

	let preloadedDetails: Preloaded<typeof api.semesterPlanning.applications.queries.get>;
	try {
		preloadedDetails = await preloadQuery(
			api.semesterPlanning.applications.queries.get,
			{ applicationId: id as Id<"companyApplications"> },
			{ token },
		);
	} catch (error) {
		// A malformed or deleted id is a 404; anything else is a real error.
		if (isMissingDocumentError(error)) notFound();
		throw error;
	}

	return <ApplicationPage preloadedDetails={preloadedDetails} />;
}
