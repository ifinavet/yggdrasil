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
				}),
			}),
		);
	});

	it("retries Slack failures twice and stops after the third attempt", async () => {
		const { t } = await setup();
		vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "down" }) }),
		);

		await expect(
			t.action(internal.iam.notifications.sendMessage, {
				channel: SYSTEM_ALERTS_CHANNEL,
				text: "hello",
				clientMsgId: "order-test",
			}),
		).rejects.toThrow("Slack avviste meldingen: down.");
		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		expect(scheduled.map(({ args }) => args)).toEqual([
			[{ channel: SYSTEM_ALERTS_CHANNEL, text: "hello", clientMsgId: "order-test", attempt: 2 }],
		]);

		await expect(
			t.action(internal.iam.notifications.sendMessage, {
				channel: SYSTEM_ALERTS_CHANNEL,
				text: "hello",
				clientMsgId: "order-test",
				attempt: 3,
			}),
		).rejects.toThrow("Slack avviste meldingen: down.");
		const afterThirdAttempt = await t.run((ctx) =>
			ctx.db.system.query("_scheduled_functions").collect(),
		);
		expect(afterThirdAttempt).toHaveLength(1);
	});
});
