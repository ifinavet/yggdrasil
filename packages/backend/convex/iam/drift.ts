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

export function computeDrift(
	directory: Directory,
	googleUsers: readonly Omit<GoogleUser, "hasSignedIn">[] | null,
	slackMembers: readonly SlackMember[] | null,
): DriftRow[] {
	const unknown = (email: string) =>
		!directory.memberEmails.has(email) && !directory.reservedEmails.has(email);
	const rows: DriftRow[] = [];

	if (googleUsers) {
		for (const user of googleUsers) {
			if (!user.suspended && unknown(user.email)) {
				rows.push({ kind: "google_without_member", email: user.email, name: user.name });
			}
		}
		const activeGoogle = new Set(googleUsers.filter((user) => !user.suspended).map((u) => u.email));
		for (const email of directory.internalWorkspaceEmails) {
			if (!activeGoogle.has(email)) rows.push({ kind: "member_google_suspended", email });
		}
	}

	if (slackMembers) {
		for (const member of slackMembers) {
			if (!member.deactivated && unknown(member.email)) {
				rows.push({ kind: "slack_without_member", email: member.email, name: member.name });
			}
		}
	}

	return rows;
}
