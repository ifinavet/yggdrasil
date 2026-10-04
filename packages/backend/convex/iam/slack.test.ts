import { afterEach, describe, expect, it, vi } from "vitest";
import { slackClient } from "./slack";

afterEach(() => vi.unstubAllGlobals());

function slackFetch(reply: (method: string, params: URLSearchParams) => Response) {
	return vi.fn(async (url: string, init: RequestInit) => {
		const method = new URL(url).pathname.split("/").at(-1) ?? "";
		return reply(method, new URLSearchParams(String(init.body)));
	});
}

describe("Slack private-channel archival", () => {
	it.each(["already_archived", "channel_not_found"])(
		"treats %s as already complete",
		async (error) => {
			vi.stubGlobal(
				"fetch",
				slackFetch(() => Response.json({ ok: false, error })),
			);
			await expect(
				slackClient({ botToken: "xoxb-test" }).archiveChannel("C123"),
			).resolves.toBeUndefined();
		},
	);

	it("does not recreate a deleted admissions channel when it is absent", async () => {
		const fetch = slackFetch((method) => {
			if (method === "conversations.list") return Response.json({ ok: true, channels: [] });
			if (method === "auth.test") return Response.json({ ok: true, user_id: "UBOT" });
			throw new Error(`Unexpected Slack method ${method}`);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(
			slackClient({ botToken: "xoxb-test" }).archivePrivateChannel("host-2026-opptak", "period"),
		).resolves.toBeUndefined();
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("finds the period channel by its private owner marker and archives it", async () => {
		const fetch = slackFetch((method) => {
			if (method === "conversations.list")
				return Response.json({
					ok: true,
					channels: [
						{
							id: "C123",
							name: "host-2026-opptak",
							creator: "UBOT",
							is_private: true,
							purpose: { value: "period" },
						},
					],
				});
			if (method === "auth.test") return Response.json({ ok: true, user_id: "UBOT" });
			if (method === "conversations.archive")
				return Response.json({ ok: false, error: "already_archived" });
			throw new Error(`Unexpected Slack method ${method}`);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(
			slackClient({ botToken: "xoxb-test" }).archivePrivateChannel("host-2026-opptak", "period"),
		).resolves.toBeUndefined();
		expect(fetch).toHaveBeenCalledTimes(3);
	});
});
