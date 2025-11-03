import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { preloadQuery } from "convex/nextjs";
import Link from "next/link";
import { Registrations } from "./registrations";

export default async function registrations(
	props: Readonly<{
		params: Promise<{ slug: Id<"events"> }>;
	}>,
) {
	const { slug: eventId } = await props.params;

	const preloadedRegistrations = await preloadQuery(
		api.registration.getByEventId,
		{ eventId },
	);

	return (
		<div className="space-y-4">
			<Registrations preloadedRegistrations={preloadedRegistrations} />
			<Button>
				<Link href={`/events/${eventId}/report`}>Rapport over påmeldte</Link>
			</Button>
		</div>
	);
}
