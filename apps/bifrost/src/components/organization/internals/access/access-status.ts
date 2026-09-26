import type { api } from "@workspace/backend/convex/api";
import { isUioEmail } from "@workspace/shared/iam";
import type { FunctionReturnType } from "convex/server";

export type AccessOverview = FunctionReturnType<typeof api.iam.queries.overview>;
export type AccessAccount = AccessOverview["accounts"][number];
export type AccessDrift = AccessOverview["drift"][number];

export type AccessAction = "retry" | "cancel" | "slackDeactivated";
export type AccessTone = "working" | "waiting" | "failed" | "todo";

export type AccessStatus = Readonly<{
	tone: AccessTone;
	text: string;
	actions: readonly AccessAction[];
}>;

export function accountStatus(account: AccessAccount): AccessStatus {
	const canCancel = account.stage === "onboarding";
	if (account.lastError) {
		return {
			tone: "failed",
			text: account.lastError,
			actions: canCancel ? ["retry", "cancel"] : ["retry"],
		};
	}
	switch (account.stage) {
		case "onboarding":
			return account.welcomeSent
				? { tone: "waiting", text: "Venter på første innlogging", actions: ["cancel"] }
				: { tone: "working", text: "Oppretter konto", actions: ["cancel"] };
		case "offboarding":
		case "cancelled":
			return { tone: "working", text: "Fjerner tilgang", actions: [] };
		case "offboarded":
			return {
				tone: "todo",
				text: "Deaktiver Slack-kontoen i Slack-admin",
				actions: ["slackDeactivated"],
			};
		default:
			return { tone: "working", text: "Sender velkomstmelding", actions: [] };
	}
}

export function driftText(drift: AccessDrift) {
	switch (drift.kind) {
		case "google_without_member":
			return "Har Google-konto, men er ikke medlem.";
		case "member_google_suspended":
			return "Er intern, men Google-kontoen er suspendert.";
		case "slack_without_member":
			return "Er i Slack, men er ikke medlem.";
	}
}

export type OnboardingPrefill = Readonly<{
	firstName: string;
	lastName: string;
	uioEmail: string;
	workspaceEmail: string;
}>;

export function prefillFromDrift(drift: AccessDrift): OnboardingPrefill | null {
	if (drift.kind === "member_google_suspended") return null;
	const [firstName = "", ...rest] = (drift.name ?? "").trim().split(/\s+/);
	const uio = isUioEmail(drift.email);
	return {
		firstName,
		lastName: rest.join(" "),
		uioEmail: uio ? drift.email : "",
		workspaceEmail: uio ? "" : drift.email,
	};
}

export function missingIntegrations(
	overview: Pick<AccessOverview, "google" | "slack" | "slackInvite">,
) {
	return [
		...(overview.google ? [] : ["Google Workspace"]),
		...(overview.slack ? [] : ["Slack"]),
		...(overview.slackInvite ? [] : ["Slack-invitasjonslenken"]),
	];
}
