"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQuery } from "convex/react";
import { AudiencePanel } from "./audience-panel";

export function EventAudience({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const audience = useQuery(api.engagement.queries.eventAudience, { eventId });
	if (!audience) return <Skeleton className="h-72 rounded-lg" />;
	return (
		<AudiencePanel
			title="Hvem har meldt seg på"
			audience={audience}
			reachLabel="Andel av kullet påmeldt"
			reachNote="Hvor stor del av hvert kull som er påmeldt dette arrangementet."
		/>
	);
}
