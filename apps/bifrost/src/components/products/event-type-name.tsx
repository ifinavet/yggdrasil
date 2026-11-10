"use client";

import { api } from "@workspace/backend/convex/api";
import type { EventType } from "@workspace/shared/semester/labels";
import { useQuery } from "convex/react";

export function useEventTypeNames(): Partial<Record<EventType, string>> {
	return useQuery(api.products.queries.eventTypeNames) ?? {};
}

export function EventTypeName({ type }: Readonly<{ type: EventType }>) {
	return useEventTypeNames()[type];
}
