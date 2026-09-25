// The bot token (SLACK_BOT_TOKEN) needs the scopes groups:write, chat:write, users:read and users:read.email.
const SLACK_API = "https://slack.com/api";

export class SlackApiError extends Error {
	constructor(
		readonly method: string,
		readonly code: string,
	) {
		super(`Slack ${method} failed: ${code}`);
	}
}

type SlackResponse = { ok: boolean; error?: string };

/** Minimal Slack Web API client. Form encoding is accepted by every method we use. */
export function slackClient(token: string) {
	async function call<T>(method: string, params: Record<string, string>): Promise<T> {
		const response = await fetch(`${SLACK_API}/${method}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams(params),
		});
		if (!response.ok) throw new SlackApiError(method, `http_${response.status}`);
		const body = (await response.json()) as SlackResponse & T;
		if (!body.ok) throw new SlackApiError(method, String(body.error));
		return body;
	}

	return {
		async createPrivateChannel(name: string): Promise<string> {
			const { channel } = await call<{ channel: { id: string } }>("conversations.create", {
				name,
				is_private: "true",
			});
			return channel.id;
		},
		async findUserIdByEmail(email: string): Promise<string | null> {
			try {
				const { user } = await call<{ user: { id: string } }>("users.lookupByEmail", { email });
				return user.id;
			} catch (error) {
				if (error instanceof SlackApiError && error.code === "users_not_found") return null;
				throw error;
			}
		},
		async invite(channel: string, users: string[]): Promise<void> {
			try {
				// force invites the valid users even if some are already members.
				await call("conversations.invite", { channel, users: users.join(","), force: "true" });
			} catch (error) {
				if (error instanceof SlackApiError && error.code === "already_in_channel") return;
				throw error;
			}
		},
		async postMessage(channel: string, text: string): Promise<void> {
			await call("chat.postMessage", { channel, text });
		},
		async archive(channel: string): Promise<void> {
			await call("conversations.archive", { channel });
		},
	};
}

export type SlackClient = ReturnType<typeof slackClient>;
