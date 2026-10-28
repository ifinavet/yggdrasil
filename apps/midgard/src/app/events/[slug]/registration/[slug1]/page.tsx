import { getAuthToken } from "@workspace/auth";
import { auth } from "@workspace/auth/server";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { humanReadableDate } from "@workspace/shared/time";
import ResponsiveCenterContainer from "@workspace/ui/components/responsive-center-container";
import { Title } from "@workspace/ui/components/title";
import { fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { notFoundOnConvexError } from "@/lib/notFoundOnConvexError";
import { withRedirect } from "@/utils/auth-redirect";
import Register from "./register";

type Props = Readonly<{
	searchParams: Promise<{ response?: string | string[] }>;
	params: Promise<{ slug: Id<"events">; slug1: Id<"registrations"> }>;
}>;

export default function RegistrationPage(props: Props) {
	return (
		<Suspense fallback={null}>
			<Registration {...props} />
		</Suspense>
	);
}

async function Registration({ params, searchParams }: Props) {
	const { isAuthenticated } = await auth();
	const { slug: eventId, slug1: registrationId } = await params;

	const { response } = await searchParams;
	const choice = response === "accept" || response === "decline" ? response : undefined;

	const headerList = await headers();
	const pathname = headerList.get("x-pathname") || "/";

	if (!isAuthenticated) {
		const returnPath = choice
			? `${pathname}?${new URLSearchParams({ response: choice })}`
			: pathname;
		return redirect(withRedirect("/sign-in", returnPath));
	}

	const token = await getAuthToken();
	const event = await fetchQuery(
		api.events.queries.getEvent,
		{ identifier: eventId },
		{ token },
	).catch(notFoundOnConvexError);

	return (
		<ResponsiveCenterContainer>
			<Title>Det har blitt en ledig plass til deg!</Title>
			<h2 className="mb-4 scroll-m-20 pb-2 text-center font-semibold text-3xl tracking-tight first:mt-0">
				Arrangement: {event.title} den {humanReadableDate(new Date(event.eventStart))}
			</h2>

			<Suspense fallback={null}>
				<RegistrationStatusHandler
					registrationId={registrationId}
					eventId={eventId}
					response={choice}
				/>
			</Suspense>
		</ResponsiveCenterContainer>
	);
}

async function RegistrationStatusHandler({
	registrationId,
	eventId,
	response,
}: Readonly<{
	registrationId: Id<"registrations">;
	eventId: Id<"events">;
	response?: "accept" | "decline";
}>) {
	const token = await getAuthToken();
	const registration = await fetchQuery(
		api.events.registrations.queries.getById,
		{ id: registrationId },
		{ token },
	).catch(notFoundOnConvexError);

	if (registration.status === "pending") {
		return <Register registrationId={registration._id} eventId={eventId} response={response} />;
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
