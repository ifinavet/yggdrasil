import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { preloadQuery } from "convex/nextjs";
import { Suspense } from "react";
import { Registrations } from "./registrations";

type Props = Readonly<{
	params: Promise<{ slug: Id<"events"> }>;
}>;

export default function RegistrationsPage(props: Props) {
	return (
		<Suspense fallback={null}>
			<EventRegistrations {...props} />
		</Suspense>
	);
}

async function EventRegistrations(props: Props) {
	const { slug } = await props.params;

	const token = await getAuthToken();
	const preloadedRegistrations = await preloadQuery(
		api.events.registrations.queries.getByEventId,
		{ eventIdentifier: slug },
		{ token },
	);

	return (
		<div className="space-y-4">
			<Registrations preloadedRegistrations={preloadedRegistrations} />
		</div>
	);
}
