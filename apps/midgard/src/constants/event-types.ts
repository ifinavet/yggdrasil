import type { api } from "@workspace/backend/convex/api";
import type { FunctionReturnType } from "convex/server";

export type EventWithParticipationCount = FunctionReturnType<
	typeof api.events.queries.getCurrentSemester
>[string][number];
