import type { Id } from "@workspace/backend/convex/dataModel";

export type Organizer = {
	_id: string;
	role: string;
	name: string;
};

export type Event = {
	_id: Id<"events">;
	title: string;
	hostingCompanyName: string;
	eventStart: number;
	published: boolean;
	externalUrl?: string;
	organizers: Organizer[];
};

export type OrganizerRole = "hovedansvarlig" | "medhjelper";
