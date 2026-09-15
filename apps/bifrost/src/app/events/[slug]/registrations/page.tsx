import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { preloadQuery } from "convex/nextjs";
import { Registrations } from "./registrations";

export default async function registrations(
	props: Readonly<{
		params: Promise<{ slug: Id<"events"> }>;
	}>,
) {
	const { slug } = await props.params;

	const preloadedRegistrations = await preloadQuery(
		api.events.registrations.queries.getByEventId,
		{ eventIdentifier: slug },
	);

	return (
		<div className="space-y-4">
			<Registrations preloadedRegistrations={preloadedRegistrations} />
		</div>
	);
}
