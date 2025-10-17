import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { preloadQuery } from "convex/nextjs";
import { Registrations } from "./registrations";

export default async function registrations(props: { params: Promise<{ slug: Id<"events"> }> }) {
	const { slug: eventId } = await props.params;

	const preloadedRegistrations = await preloadQuery(api.registration.getByEventId, { eventId });

	return (
		<div className="space-y-4">
			<Registrations preloadedRegistrations={preloadedRegistrations} />
		</div>
	);
}
