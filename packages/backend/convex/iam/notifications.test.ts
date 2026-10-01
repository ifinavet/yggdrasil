import { formatOrderAlert } from "@workspace/shared/slack/alerts";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setup } from "../../test/fixtures";
import { internal } from "../_generated/api";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("Slack order alert format", () => {
	it("includes the price, details and link, and omits empty notes", () => {
		const text = formatOrderAlert({
			company: "Fjordkode AS",
			type: "Stillingsannonse",
			title: ["Backendutvikler", "Frontendutvikler"],
			estimatedRevenueOre: 550_000,
			url: "https://bifrost.ifinavet.no/job-listings",
		});

		expect(text).toContain("*💸 Ny bestilling*");
		expect(text).toContain("*Bedrift:* Fjordkode AS");
		expect(text).toContain("*Type:* Stillingsannonse");
		expect(text).toContain("*Tittel:* Backendutvikler, Frontendutvikler");
		expect(text).toContain("*Estimert inntekt:*");
		expect(text).toContain("eks. mva");
		expect(text).toContain("<https://bifrost.ifinavet.no/job-listings|Åpne i Bifrost>");
		expect(text).not.toContain("Tilleggsinformasjon");
	});

	it("shows zero as a real price and reports an unknown estimate", () => {
		expect(
			formatOrderAlert({ company: "A", type: "B", title: "C", estimatedRevenueOre: 0 }),
		).toContain("*Estimert inntekt:*");
		expect(
			formatOrderAlert({ company: "A", type: "B", title: "C", estimatedRevenueOre: 0 }),
		).toContain("eks. mva");
		expect(
			formatOrderAlert({ company: "A", type: "B", title: "C", estimatedRevenueOre: 0 }),
		).not.toContain("Ikke beregnet");
		expect(formatOrderAlert({ company: "A", type: "B", title: "C" })).toContain(
			"*Estimert inntekt:* Ikke beregnet",
		);
	});

	it("skips Slack when no bot token is configured", async () => {
		const { t } = await setup();
		vi.stubEnv("SLACK_BOT_TOKEN", "");
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await t.action(internal.iam.notifications.sendMessage, {
			channel: SYSTEM_ALERTS_CHANNEL,
			text: "hello",
			clientMsgId: "order-test",
		});

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("sends messages to the central channel using Slack chat.postMessage", async () => {
		const { t } = await setup();
		vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
		vi.stubGlobal("fetch", fetchMock);

		await t.action(internal.iam.notifications.sendMessage, {
			channel: SYSTEM_ALERTS_CHANNEL,
			text: "hello",
			clientMsgId: "order-test",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://slack.com/api/chat.postMessage",
			expect.objectContaining({
				method: "POST",
				body: new URLSearchParams({
					channel: SYSTEM_ALERTS_CHANNEL,
					text: "hello",
					client_msg_id: "order-test",
					metadata: JSON.stringify({
						event_type: "yggdrasil_event_notice",
						event_payload: { key: "order-test" },
					}),
				}),
			}),
		);
	});
});

describe("durable Slack system delivery", () => {
	it("recovers after more than three failures and does not repeat a confirmed delivery", async () => {
		vi.useFakeTimers();
		vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
		let failing = true;
		let posted = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) => {
				if (url.endsWith("conversations.history"))
					return new Response(JSON.stringify({ ok: true, messages: [] }));
				if (failing) return new Response(JSON.stringify({ ok: false, error: "internal_error" }));
				posted++;
				return new Response(JSON.stringify({ ok: true }));
			}),
		);
		try {
			const { t } = await setup();
			const args = { channel: SYSTEM_ALERTS_CHANNEL, text: "Opening", clientMsgId: "durable-open" };
			for await (const attempt of [1, 2, 3, 4]) {
				vi.setSystemTime(Date.now() + 60 * 60 * 1000);
				await t
					.action(internal.iam.notifications.sendMessage, { ...args, attempt })
					.catch(() => {});
			}
			failing = false;
			vi.setSystemTime(Date.now() + 60 * 60 * 1000);
			await t.action(internal.iam.notifications.retryPending, {});
			await t.action(internal.iam.notifications.sendMessage, args);
			await t.action(internal.iam.notifications.retryPending, {});
			expect(posted).toBe(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("recovers a successful post whose response was lost without posting a duplicate", async () => {
		vi.useFakeTimers();
		vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
		const delivered: { client_msg_id: string }[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string, init: RequestInit) => {
				const args = Object.fromEntries(new URLSearchParams(init.body as string));
				if (url.endsWith("conversations.history"))
					return new Response(JSON.stringify({ ok: true, messages: delivered }));
				delivered.push({ client_msg_id: args.client_msg_id as string });
				throw new Error("response lost");
			}),
		);
		try {
			const { t } = await setup();
			await t
				.action(internal.iam.notifications.sendMessage, {
					channel: SYSTEM_ALERTS_CHANNEL,
					text: "Ready",
					clientMsgId: "lost-response",
				})
				.catch(() => {});
			vi.setSystemTime(Date.now() + 60 * 60 * 1000);
			await t.action(internal.iam.notifications.retryPending, {});
			expect(delivered).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
