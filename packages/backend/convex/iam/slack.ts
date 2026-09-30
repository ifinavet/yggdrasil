import { SLACK_API_URL } from "@workspace/shared/constants";
import { normalizeEmail } from "@workspace/shared/iam";
import { directoryUrl, type SlackConfig } from "./config";

const TIMEOUT_MS = 15_000;
const MAX_PAGES = 20;

export type SlackMember = Readonly<{
	id: string;
	email: string;
	name: string;
	deactivated: boolean;
}>;

type SlackUser = {
	id: string;
	deleted?: boolean;
	is_bot?: boolean;
	real_name?: string;
	profile?: { email?: string; real_name?: string };
};

type SlackResponse = {
	ok: boolean;
	error?: string;
	response_metadata?: { next_cursor?: string };
};

export class SlackError extends Error {}

export function slackClient(config: SlackConfig) {
	async function call<T>(method: string, params: Record<string, string>) {
		const response = await fetch(directoryUrl(`${SLACK_API_URL}/${method}`), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.botToken}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams(params),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) throw new SlackError(`Slack svarte ${response.status} på ${method}.`);
		return (await response.json()) as SlackResponse & T;
	}

	async function paginate<T>(
		method: string,
		params: Record<string, string>,
		pick: (body: SlackResponse & T) => unknown[],
	) {
		const items: unknown[] = [];
		let cursor = "";
		for (let page = 0; page < MAX_PAGES; page++) {
			const body = await call<T>(method, { ...params, limit: "200", ...(cursor && { cursor }) });
			if (!body.ok) throw new SlackError(`Slack avviste ${method}: ${body.error}.`);
			items.push(...pick(body));
			cursor = body.response_metadata?.next_cursor ?? "";
			if (!cursor) return items;
		}
		throw new SlackError(`Slack returnerte for mange sider fra ${method}.`);
	}

	return {
		/** Recover a bot-created channel after a successful create whose response was lost. */
		async ensurePrivateChannel(name: string, owner: string): Promise<string> {
			const created = await call<{ channel?: { id: string } }>("conversations.create", {
				name,
				is_private: "true",
			});
			if (created.ok && created.channel) return created.channel.id;
			if (created.error !== "name_taken")
				throw new SlackError(`Slack avviste kanalen: ${created.error}.`);
			const channels = (await paginate<{
				channels?: {
					id: string;
					name: string;
					creator: string;
					is_private: boolean;
					purpose?: { value: string };
				}[];
			}>(
				"conversations.list",
				{ types: "private_channel", exclude_archived: "false" },
				(body) => body.channels ?? [],
			)) as {
				id: string;
				name: string;
				creator: string;
				is_private: boolean;
				purpose?: { value: string };
			}[];
			const auth = await call<{ user_id: string }>("auth.test", {});
			const channel = channels.find(
				(channel) =>
					channel.name === name &&
					channel.is_private &&
					channel.creator === auth.user_id &&
					(!channel.purpose?.value || channel.purpose.value === owner),
			);
			if (!channel) throw new SlackError("Kanalnavnet er i bruk av en annen kanal.");
			return channel.id;
		},
		async renameChannel(channel: string, name: string) {
			const body = await call("conversations.rename", { channel, name });
			if (!body.ok) throw new SlackError(`Slack avviste kanalnavnet: ${body.error}.`);
		},
		async setChannelPurpose(channel: string, purpose: string) {
			const body = await call("conversations.setPurpose", { channel, purpose });
			if (!body.ok) throw new SlackError(`Slack avviste kanalbeskrivelsen: ${body.error}.`);
		},
		async setArchived(channel: string, archived: boolean) {
			const body = await call(`conversations.${archived ? "archive" : "unarchive"}`, { channel });
			if (!body.ok && body.error !== (archived ? "already_archived" : "not_archived"))
				throw new SlackError(`Slack avviste arkiveringen: ${body.error}.`);
		},
		async reconcileChannelMembers(channel: string, desired: string[]) {
			const auth = await call<{ user_id: string }>("auth.test", {});
			if (!auth.ok) throw new SlackError("Kunne ikke identifisere Slack-boten.");
			const current = (await paginate<{ members?: string[] }>(
				"conversations.members",
				{ channel },
				(body) => body.members ?? [],
			)) as string[];
			for (const user of current) {
				if (user === auth.user_id || desired.includes(user)) continue;
				const body = await call("conversations.kick", { channel, user });
				if (!body.ok && body.error !== "not_in_channel" && body.error !== "user_not_in_channel")
					throw new SlackError(`Slack avviste fjerningen: ${body.error}.`);
			}
			for (const user of desired) {
				if (current.includes(user)) continue;
				const body = await call("conversations.invite", { channel, users: user });
				if (!body.ok && body.error !== "already_in_channel")
					throw new SlackError(`Slack avviste invitasjonen: ${body.error}.`);
			}
		},
		async hasMessage(channel: string, clientMsgId: string) {
			type Message = {
				client_msg_id?: string;
				metadata?: { event_type?: string; event_payload?: { key?: string } };
			};
			const messages = (await paginate<{ messages?: Message[] }>(
				"conversations.history",
				{ channel, include_all_metadata: "true" },
				(body) => body.messages ?? [],
			)) as Message[];
			return messages.some(
				(message) =>
					message.client_msg_id === clientMsgId ||
					(message.metadata?.event_type === "yggdrasil_event_notice" &&
						message.metadata.event_payload?.key === clientMsgId),
			);
		},

		async postMessage(channel: string, text: string, clientMsgId: string, recoverable = false) {
			const body = await call("chat.postMessage", {
				channel,
				text,
				client_msg_id: clientMsgId,
				...(recoverable && {
					metadata: JSON.stringify({
						event_type: "yggdrasil_event_notice",
						event_payload: { key: clientMsgId },
					}),
				}),
			});
			if (!body.ok) throw new SlackError(`Slack avviste meldingen: ${body.error}.`);
		},

		async lookupByEmail(email: string): Promise<string | null> {
			const body = await call<{ user?: SlackUser }>("users.lookupByEmail", { email });
			if (body.ok) return body.user?.id ?? null;
			if (body.error === "users_not_found") return null;
			throw new SlackError(`Slack avviste oppslaget: ${body.error}.`);
		},

		async listMembers(): Promise<SlackMember[]> {
			const users = (await paginate<{ members?: SlackUser[] }>(
				"users.list",
				{},
				(body) => body.members ?? [],
			)) as SlackUser[];
			return users
				.filter((user) => !user.is_bot && user.id !== "USLACKBOT" && user.profile?.email)
				.map((user) => ({
					id: user.id,
					email: normalizeEmail(user.profile?.email ?? ""),
					name: user.profile?.real_name ?? user.real_name ?? "",
					deactivated: user.deleted === true,
				}));
		},
	};
}
