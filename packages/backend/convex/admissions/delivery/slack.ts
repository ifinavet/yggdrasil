import type { Doc } from "../../_generated/dataModel";
import { slackConfig } from "../../iam/config";
import { slackClient } from "../../iam/slack";

export type Slack = ReturnType<typeof slackClient>;
type Period = Doc<"admissionPeriods">;
type Person = Readonly<{ email: string }>;

function channelName(period: Period) {
	const title = period.title
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replaceAll("ø", "o")
		.replaceAll("æ", "ae")
		.replaceAll("å", "a")
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.slice(0, 50);
	return `${title || "opptak"}-opptak`;
}

export async function ensureAdmissionsChannel(slack: Slack, period: Period, people: Person[]) {
	const owner = `admissions:${period._id}`;
	const name = channelName(period);
	const channel = await slack.ensurePrivateChannel(
		name,
		owner,
		`${name.slice(0, 40)}-${period._id}`,
	);
	const info = await slack.channelInfo(channel);
	if (info.purpose?.value !== owner) await slack.setChannelPurpose(channel, owner);
	const members = await Promise.all(people.map(({ email }) => slack.lookupByEmail(email)));
	if (members.some((id) => !id))
		throw new Error(
			"En eller flere intervjuere mangler en aktiv Slack-konto med samme e-postadresse.",
		);
	await slack.reconcileChannelMembers(channel, [...new Set(members as string[])], [], () =>
		Promise.resolve(undefined),
	);
	return channel;
}

export async function postAdmissionsNotice(
	slack: Slack,
	channel: string,
	key: string,
	since: number,
	text: string,
) {
	if (!(await slack.hasMessage(channel, key, since)))
		await slack.postMessage(channel, text, key, true);
}

export async function archiveAdmissionsChannel(slack: Slack, period: Period) {
	const name = channelName(period);
	await slack.archivePrivateChannel(name, `admissions:${period._id}`);
}

export function admissionsSlack() {
	const config = slackConfig();
	if (!config) throw new Error("SLACK_BOT_TOKEN er ikke satt for opptaksvarsler.");
	return slackClient(config);
}
