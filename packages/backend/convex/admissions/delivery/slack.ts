import { admissionsChannelNames } from "@workspace/shared/slack/channels";
import type { Doc } from "../../_generated/dataModel";
import { slackConfig } from "../../iam/config";
import { slackClient } from "../../iam/slack";

export type Slack = ReturnType<typeof slackClient>;
type Period = Doc<"admissionPeriods">;
type Person = Readonly<{ email: string }>;

export async function ensureAdmissionsChannel(
	slack: Slack,
	period: Period,
	people: Person[],
	persistManaged: (users: string[]) => Promise<unknown>,
) {
	const owner = `admissions:${period._id}`;
	const { name, fallbackName } = admissionsChannelNames(period.applicationStartAt, period._id);
	const channel = await slack.ensurePrivateChannel(name, owner, fallbackName);
	const info = await slack.channelInfo(channel);
	if (info.purpose?.value !== owner) await slack.setChannelPurpose(channel, owner);
	const members = await Promise.all(people.map(({ email }) => slack.lookupByEmail(email)));
	if (members.some((id) => !id))
		throw new Error(
			"En eller flere intervjuere mangler en aktiv Slack-konto med samme e-postadresse.",
		);
	await slack.reconcileChannelMembers(
		channel,
		[...new Set(members as string[])],
		period.slackManagedMemberIds ?? [],
		persistManaged,
		true,
	);
	return channel;
}

export async function archiveAdmissionsChannel(slack: Slack, period: Period) {
	const { name, fallbackName } = admissionsChannelNames(period.applicationStartAt, period._id);
	const channel = await slack.findOwnedPrivateChannel(
		[name, fallbackName],
		`admissions:${period._id}`,
	);
	if (channel) await slack.archiveChannel(channel);
}

export function admissionsSlack() {
	const config = slackConfig();
	if (!config) throw new Error("SLACK_BOT_TOKEN er ikke satt for opptaksvarsler.");
	return slackClient(config);
}
