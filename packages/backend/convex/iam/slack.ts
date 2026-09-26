import { normalizeEmail } from "@workspace/shared/iam";
import type { SlackConfig } from "./config";

const API_URL = "https://slack.com/api";
const TIMEOUT_MS = 15_000;
const MAX_PAGES = 20;
const SKIPPED_KICK_ERRORS = new Set(["cant_kick_from_general", "channel_not_found", "is_archived"]);

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
		const response = await fetch(`${API_URL}/${method}`, {
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
		async lookupByEmail(email: string): Promise<string | null> {
			const body = await call<{ user?: SlackUser }>("users.lookupByEmail", { email });
			if (body.ok) return body.user?.id ?? null;
			if (body.error === "users_not_found") return null;
			throw new SlackError(`Slack avviste oppslaget: ${body.error}.`);
		},

		async channelsOf(userId: string): Promise<string[]> {
			const channels = await paginate<{ channels?: { id: string }[] }>(
				"users.conversations",
				{ user: userId, types: "public_channel,private_channel", exclude_archived: "true" },
				(body) => body.channels ?? [],
			);
			return (channels as { id: string }[]).map((channel) => channel.id);
		},

		async kick(channel: string, userId: string): Promise<"removed" | "skipped" | "failed"> {
			const body = await call("conversations.kick", { channel, user: userId });
			if (body.ok) return "removed";
			if (body.error && SKIPPED_KICK_ERRORS.has(body.error)) return "skipped";
			return "failed";
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
