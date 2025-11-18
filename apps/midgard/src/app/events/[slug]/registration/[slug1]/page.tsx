import { auth } from "@clerk/nextjs/server";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { fetchQuery, preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import { humanReadableDate } from "@/utils/dateFormatting";
import Register from "./register";

export default async function RegistrationPage({
	params,
}: Readonly<{
	params: Promise<{ slug: Id<"events">; slug1: Id<"registrations"> }>;
}>) {
	const { isAuthenticated } = await auth();
	const { slug: eventId, slug1: registrationId } = await params;

	const headerList = await headers();
	const pathname = headerList.get("x-pathname") || "/";

	if (!isAuthenticated) return redirect(`/sign-in/?redirect=${pathname}`);

	const event = await fetchQuery(api.events.getEvent, { identifier: eventId });

	return (
		<ResponsiveCenterContainer>
			<Title>Det har blitt en ledig plass til deg!</Title>
			<h2 className="mb-4 scroll-m-20 pb-2 text-center font-semibold text-3xl tracking-tight first:mt-0">
				Arrangement: {event.title} den{" "}
				{humanReadableDate(new Date(event.eventStart))}
			</h2>

			<RegistrationStatusHandler
				registrationId={registrationId}
				eventId={eventId}
			/>
		</ResponsiveCenterContainer>
	);
}

async function RegistrationStatusHandler({
	registrationId,
	eventId,
}: Readonly<{ registrationId: Id<"registrations">; eventId: Id<"events"> }>) {
	const preloadedRegistration = await preloadQuery(api.registration.getById, {
		id: registrationId,
	});
	const registration = preloadedQueryResult(preloadedRegistration);

	if (registration.status === "pending") {
		return (
			<Register
				preloadedRegistration={preloadedRegistration}
				eventId={eventId}
			/>
		);
	}

	if (registration.status === "registered") {
		return (
			<div className="text-center">
				<p>Du er allerede registrert</p>
			</div>
		);
	}

	return (
		<div className="text-center">
			<p>Du er på venteliste</p>
		</div>
	);
}
