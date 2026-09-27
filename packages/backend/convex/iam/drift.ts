import type { Infer } from "convex/values";
import type { GoogleUser } from "./google";
import type { driftKinds } from "./schema";
import type { SlackMember } from "./slack";

export type DriftKind = Infer<typeof driftKinds>;

export type DriftRow = Readonly<{ kind: DriftKind; email: string; name?: string }>;

export type Directory = Readonly<{
	memberEmails: ReadonlySet<string>;
	internalWorkspaceEmails: ReadonlySet<string>;
	reservedEmails: ReadonlySet<string>;
}>;

type GoogleDirectoryUser = Omit<GoogleUser, "hasSignedIn" | "id">;

const isUnknown = (directory: Directory, email: string) =>
	!directory.memberEmails.has(email) && !directory.reservedEmails.has(email);

function googleDrift(
	directory: Directory,
	googleUsers: readonly GoogleDirectoryUser[],
): DriftRow[] {
	const active = googleUsers.filter((user) => !user.suspended);
	const activeEmails = new Set(active.map((user) => user.email));
	const withoutMember = active
		.filter((user) => isUnknown(directory, user.email))
		.map((user) => ({
			kind: "google_without_member" as const,
			email: user.email,
			name: user.name,
		}));
	const suspended = [...directory.internalWorkspaceEmails]
		.filter((email) => !activeEmails.has(email))
		.map((email) => ({ kind: "member_google_suspended" as const, email }));
	return [...withoutMember, ...suspended];
}

function slackDrift(directory: Directory, slackMembers: readonly SlackMember[]): DriftRow[] {
	return slackMembers
		.filter((member) => !member.deactivated && isUnknown(directory, member.email))
		.map((member) => ({
			kind: "slack_without_member" as const,
			email: member.email,
			name: member.name,
		}));
}

export function computeDrift(
	directory: Directory,
	googleUsers: readonly GoogleDirectoryUser[] | null,
	slackMembers: readonly SlackMember[] | null,
): DriftRow[] {
	return [
		...(googleUsers ? googleDrift(directory, googleUsers) : []),
		...(slackMembers ? slackDrift(directory, slackMembers) : []),
	];
}
