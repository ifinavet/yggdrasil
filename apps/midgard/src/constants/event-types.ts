import type { Doc } from "@workspace/backend/convex/dataModel";

export type EventWithParticipationCount = Doc<"events"> & {
	participationCount: number;
};
