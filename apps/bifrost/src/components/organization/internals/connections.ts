import type { api } from "@workspace/backend/convex/api";
import type { FunctionReturnType } from "convex/server";

export type Connections = NonNullable<
	FunctionReturnType<typeof api.users.organization.queries.getAllInternals>[number]["connections"]
>;

export type ConnectionState = Readonly<{ connected: boolean; text: string }>;

const GOOGLE_TEXT: Record<Connections["google"], ConnectionState> = {
	pending: { connected: false, text: "Oppretter konto" },
	created: { connected: true, text: "Konto opprettet av Bifrost" },
	existing: { connected: true, text: "Bruker en konto som fantes fra før" },
	suspended: { connected: false, text: "Suspendert" },
	not_applicable: { connected: false, text: "Har ingen konto på domenet" },
};

export function googleConnection(connections: Connections): ConnectionState {
	return GOOGLE_TEXT[connections.google];
}

export function slackConnection(connections: Connections): ConnectionState {
	if (connections.slackLinked) return { connected: true, text: "Er med i Slack" };
	if (connections.welcomeSent)
		return { connected: false, text: "Invitert, har ikke blitt med ennå" };
	return { connected: false, text: "Ikke invitert ennå" };
}
