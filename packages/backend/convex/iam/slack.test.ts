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

	it("returns no channel when a deleted admissions channel is absent", async () => {
		const fetch = slackFetch((method) => {
			if (method === "conversations.list") return Response.json({ ok: true, channels: [] });
			if (method === "auth.test") return Response.json({ ok: true, user_id: "UBOT" });
			throw new Error(`Unexpected Slack method ${method}`);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(
			slackClient({ botToken: "xoxb-test" }).findOwnedPrivateChannel(
				["host-2026-opptak"],
				"period",
			),
		).resolves.toBeNull();
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("finds the bot-owned private channel by its owner marker", async () => {
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
			throw new Error(`Unexpected Slack method ${method}`);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(
			slackClient({ botToken: "xoxb-test" }).findOwnedPrivateChannel(
				["host-2026-opptak"],
				"period",
			),
		).resolves.toBe("C123");
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("finds the bot-owned fallback name used when another period owns the preferred name", async () => {
		const fetch = slackFetch((method) => {
			if (method === "conversations.list")
				return Response.json({
					ok: true,
					channels: [
						{
							id: "C456",
							name: "host-2026-opptak-period",
							creator: "UBOT",
							is_private: true,
							purpose: { value: "period" },
						},
					],
				});
			if (method === "auth.test") return Response.json({ ok: true, user_id: "UBOT" });
			throw new Error(`Unexpected Slack method ${method}`);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(
			slackClient({ botToken: "xoxb-test" }).findOwnedPrivateChannel(
				["host-2026-opptak", "host-2026-opptak-period"],
				"period",
			),
		).resolves.toBe("C456");
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("does not return channels without the exact private owner marker", async () => {
		vi.stubGlobal(
			"fetch",
			slackFetch((method) => {
				if (method === "conversations.list")
					return Response.json({
						ok: true,
						channels: [
							{
								id: "C123",
								name: "host-2026-opptak",
								creator: "UBOT",
								is_private: true,
								purpose: { value: "another-period" },
							},
						],
					});
				if (method === "auth.test") return Response.json({ ok: true, user_id: "UBOT" });
				throw new Error(`Unexpected Slack method ${method}`);
			}),
		);
		await expect(
			slackClient({ botToken: "xoxb-test" }).findOwnedPrivateChannel(
				["host-2026-opptak"],
				"period",
			),
		).resolves.toBeNull();
	});
});

describe("Slack managed channel membership", () => {
	it("removes a departed managed member but preserves manual members", async () => {
		const fetch = slackFetch((method, params) => {
			if (method === "auth.test") return Response.json({ ok: true, user_id: "UBOT" });
			if (method === "conversations.members")
				return Response.json({ ok: true, members: ["UBOT", "U-old", "U-manual"] });
			if (method === "conversations.kick" || method === "conversations.invite")
				return Response.json({ ok: true });
			throw new Error(`Unexpected Slack method ${method} ${params}`);
		});
		vi.stubGlobal("fetch", fetch);
		const persistManaged = vi.fn().mockResolvedValue(undefined);

		await slackClient({ botToken: "xoxb-test" }).reconcileChannelMembers(
			"C123",
			["U-new"],
			["U-old"],
			persistManaged,
		);

		expect(fetch).toHaveBeenCalledTimes(4);
		expect(fetch).toHaveBeenNthCalledWith(
			3,
			expect.any(String),
			expect.objectContaining({ body: expect.any(URLSearchParams) }),
		);
		expect(String(fetch.mock.calls[2]?.[1].body)).toContain("user=U-old");
		expect(String(fetch.mock.calls[3]?.[1].body)).toContain("users=U-new");
		expect(persistManaged).toHaveBeenNthCalledWith(1, ["U-old", "U-new"]);
		expect(persistManaged).toHaveBeenNthCalledWith(2, ["U-new"]);
	});
});
