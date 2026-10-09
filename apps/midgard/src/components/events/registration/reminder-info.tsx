"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useQuery } from "convex/react";
import ContainerCard from "@/components/cards/container-card";

export default function ReminderInfo({
	className,
	eventId,
}: Readonly<{
	className?: string;
	eventId: Id<"events">;
}>) {
	const info = useQuery(api.events.reminders.queries.getOwnReminderInfo, {
		eventIdentifier: eventId,
	});

	if (!info) return null;

	return (
		<ContainerCard className={className}>
			<p className="font-semibold text-lg">Fra bedriften</p>
			<p className="whitespace-pre-line leading-7">{info}</p>
		</ContainerCard>
	);
}
