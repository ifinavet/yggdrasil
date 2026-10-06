"use client";

import { api } from "@workspace/backend/convex/api";
import type { EventGuideStep } from "@workspace/shared/events/guide";
import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import { EventGuideProvider } from "./guide";

function availableSteps(
	page: string | undefined,
	external: boolean | undefined,
): ReadonlySet<EventGuideStep> {
	if (external === undefined) return new Set();
	const steps = new Set<EventGuideStep>();
	if (page === undefined) {
		steps.add("checklist");
		if (!external) steps.add("registrations").add("report");
	}
	if (page === "registrations" && !external) steps.add("email").add("report");
	return steps;
}

export function EventPageGuide({
	identifier,
	children,
}: Readonly<{ identifier: string; children: ReactNode }>) {
	const event = useQuery(api.events.queries.getEvent, { identifier });
	const page = usePathname().split("/")[3];
	const available = useMemo(
		() => availableSteps(page, event?.externalEvent),
		[page, event?.externalEvent],
	);
	return <EventGuideProvider available={available}>{children}</EventGuideProvider>;
}
