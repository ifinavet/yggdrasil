import type { api } from "@workspace/backend/convex/api";
import type { FunctionReturnType } from "convex/server";

export type EventRegistrationSummary = FunctionReturnType<
	typeof api.events.registrations.queries.getEventRegistrationSummary
>;
