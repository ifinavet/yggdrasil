import { featureFlags } from "@workspace/shared/feature-flags";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DAY_IN_MS,
	HOUR_IN_MS,
	insertEvent,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { ARCHIVE_MESSAGE, channelName, dueReminders, REMINDERS } from "./messages";

// Thursday 22 October 2026 at 16:15 in Oslo (CEST).
const EVENT_START = Date.parse("2026-10-22T14:15:00Z");
const CHANNEL_OPENS = Date.parse("2026-09-22T07:00:00Z");
// Registration opens one week before, at 12:00 in Oslo.
const REGISTRATION_OPENS = Date.parse("2026-10-15T10:00:00Z");

type Call = { method: string; params: Record<string, string> };

function fakeSlack({
	users = {} as Record<string, string>,
	takenNames = [] as string[],
	// Returns a Slack error code, or an HTTP status for transport failures.
	fail = (_call: Call): string | number | undefined => undefined,
} = {}) {
	const calls: Call[] = [];
	let nextChannel = 1;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init: RequestInit) => {
			const method = url.split("/").at(-1) ?? "";
			const params = Object.fromEntries(new URLSearchParams(init.body as URLSearchParams));
			calls.push({ method, params });
			const reply = (body: object) => new Response(JSON.stringify(body));
			const failure = fail({ method, params });
			if (typeof failure === "number") return new Response(null, { status: failure });
			if (failure) return reply({ ok: false, error: failure });
			switch (method) {
				case "conversations.create":
					if (takenNames.includes(params.name ?? ""))
						return reply({ ok: false, error: "name_taken" });
					return reply({ ok: true, channel: { id: `C${nextChannel++}` } });
				case "users.lookupByEmail": {
					const id = users[params.email ?? ""];
					return reply(id ? { ok: true, user: { id } } : { ok: false, error: "users_not_found" });
				}
				default:
					return reply({ ok: true });
			}
		}),
	);
	const messages = (channel = "C1") =>
		calls
			.filter((call) => call.method === "chat.postMessage" && call.params.channel === channel)
			.map((call) => call.params.text ?? "");
	return { calls, messages, reset: () => calls.splice(0) };
}

async function sync(t: TestBackend, at: number) {
	vi.setSystemTime(at);
	await t.action(internal.slack.sync.syncBedpresChannels, {});
}

async function addOrganizer(
	t: TestBackend,
	eventId: Id<"events">,
	email: string,
	role: "hovedansvarlig" | "medhjelper",
) {
	const user = await insertUser(t, email, { firstName: "Ola", lastName: "Nordmann" });
	await t.run((ctx) => ctx.db.insert("eventOrganizers", { eventId, userId: user._id, role }));
	return user._id;
}

async function channelRow(t: TestBackend, eventId: Id<"events">) {
	return t.run((ctx) =>
		ctx.db
			.query("bedpresChannels")
			.withIndex("by_eventId", (index) => index.eq("eventId", eventId))
			.unique(),
	);
}

beforeEach(() => {
	vi.useFakeTimers();
	featureFlags.slackBot.enabled = true;
	vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	featureFlags.slackBot.enabled = false;
});

describe("bedpres Slack channels", () => {
	it("follows a bedpres from one month before until it is archived", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack({ users: { "leder@uio.no": "U1", "hjelper@uio.no": "U2" } });
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
			title: "Bedpres",
		});
		await addOrganizer(t, eventId, "leder@uio.no", "hovedansvarlig");
		await addOrganizer(t, eventId, "hjelper@uio.no", "medhjelper");
		await addOrganizer(t, eventId, "ukjent@uio.no", "medhjelper");

		await sync(t, CHANNEL_OPENS - 1);
		expect(slack.calls).toEqual([]);

		await sync(t, CHANNEL_OPENS);
		expect(slack.calls[0]).toEqual({
			method: "conversations.create",
			params: { name: "2026-10-22-testbedrift", is_private: "true" },
		});
		expect(slack.calls).toContainEqual({
			method: "conversations.invite",
			params: { channel: "C1", users: "U1,U2", force: "true" },
		});
		const intro = slack.messages();
		expect(intro[0]).toContain("*Bedpres* med Testbedrift, torsdag 22. oktober kl. 16:15");
		expect(intro[1]).toContain("Ola Nordmann (ukjent@uio.no)");
		expect(intro[2]).toBe("Lagt til i kanalen: <@U1> (hovedansvarlig), <@U2> (medhjelper)");
		expect(intro).toHaveLength(3);

		// Nothing is repeated, but people who were missing are looked up again.
		slack.reset();
		await sync(t, CHANNEL_OPENS + HOUR_IN_MS);
		expect(slack.calls.map((call) => call.method)).toEqual(["users.lookupByEmail"]);

		// Reminders tag the hovedansvarlig, but not medhjelpere or people missing from Slack.
		await sync(t, Date.parse("2026-10-08T07:00:00Z"));
		expect(slack.messages().at(-1)).toMatch(/^<@U1> \*To uker igjen til Bedpres/);

		await sync(t, Date.parse("2026-10-14T07:00:00Z"));
		expect(slack.messages().at(-1)).toContain(
			"Påmeldingen til Bedpres åpner torsdag 15. oktober kl. 12:00",
		);

		// A missed reminder is skipped in favour of the newest one.
		slack.reset();
		await sync(t, Date.parse("2026-10-20T07:00:00Z"));
		expect(slack.messages()).toEqual([expect.stringContaining("«22.10 – Testbedrift»")]);
		expect((await channelRow(t, eventId))?.sentReminders).toContain("one-week");

		await sync(t, Date.parse("2026-10-22T07:00:00Z"));
		expect(slack.messages().at(-1)).toContain("I dag er det Bedpres!");

		await sync(t, EVENT_START + 2 * HOUR_IN_MS);
		expect(slack.messages().at(-1)).toContain("føre utlegg");

		// Summer time ends on 25 October, so three calendar days later is 16:15 CET.
		slack.reset();
		await sync(t, EVENT_START + 3 * DAY_IN_MS);
		expect(await channelRow(t, eventId)).toMatchObject({ status: "active" });
		await sync(t, EVENT_START + 3 * DAY_IN_MS + HOUR_IN_MS);
		expect(slack.messages()).toEqual([expect.stringContaining("kanalen arkiveres")]);
		expect(slack.calls.at(-1)).toEqual({
			method: "conversations.archive",
			params: { channel: "C1" },
		});
		expect(await channelRow(t, eventId)).toMatchObject({ status: "archived" });

		slack.reset();
		await sync(t, EVENT_START + 4 * DAY_IN_MS);
		expect(slack.calls).toEqual([]);
	});

	it("archives the morning the feedback form is sent", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		await sync(t, EVENT_START - DAY_IN_MS);
		const campaign = {
			eventId,
			opensAt: EVENT_START + DAY_IN_MS,
			closesAt: EVENT_START + 15 * DAY_IN_MS,
			generation: 1,
		};
		const campaignId = await t.run((ctx) =>
			ctx.db.insert("feedbackCampaigns", { ...campaign, status: "scheduled" }),
		);

		await sync(t, EVENT_START + 12 * HOUR_IN_MS);
		expect(await channelRow(t, eventId)).toMatchObject({ status: "active" });

		await t.run((ctx) => ctx.db.patch(campaignId, { status: "open" }));
		await sync(t, EVENT_START + 18 * HOUR_IN_MS);
		expect(await channelRow(t, eventId)).toMatchObject({ status: "archived" });
		expect(slack.calls.at(-1)?.method).toBe("conversations.archive");
	});

	it("sends reminders untagged when the hovedansvarlig is not in Slack", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		await addOrganizer(t, eventId, "ukjent@uio.no", "hovedansvarlig");

		await sync(t, Date.parse("2026-10-08T07:00:00Z"));
		expect(slack.messages().at(-1)).toMatch(/^\*To uker igjen/);
	});

	it("invites organizers who are added after the channel was created", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack({ users: { "sen@uio.no": "U9" } });
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		await sync(t, CHANNEL_OPENS);
		await addOrganizer(t, eventId, "sen@uio.no", "medhjelper");

		await sync(t, CHANNEL_OPENS + HOUR_IN_MS);
		expect(slack.messages().at(-1)).toBe("Lagt til i kanalen: <@U9> (medhjelper)");
	});

	it("archives the channel when the event is deleted", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		await sync(t, CHANNEL_OPENS);
		await t.run((ctx) => ctx.db.delete(eventId));

		await sync(t, CHANNEL_OPENS + HOUR_IN_MS);
		expect(slack.calls.at(-1)?.method).toBe("conversations.archive");
	});

	it("skips external events and events more than a month away", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
			externalEvent: true,
		});
		await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START + 2 * DAY_IN_MS,
		});

		await sync(t, CHANNEL_OPENS);
		expect(slack.calls).toEqual([]);
	});

	it("picks a new name when the channel name is taken", async () => {
		const { t, companyId } = await setup();
		fakeSlack({ takenNames: ["2026-10-22-testbedrift"] });
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});

		await sync(t, CHANNEL_OPENS);
		expect(await channelRow(t, eventId)).toMatchObject({
			channelName: "2026-10-22-testbedrift-2",
		});
	});

	it("keeps syncing other channels when one fails, then reports the failure", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack({
			fail: ({ method, params }) =>
				method === "chat.postMessage" && params.channel === "C1" ? "channel_not_found" : undefined,
		});
		await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START + HOUR_IN_MS,
		});

		vi.setSystemTime(CHANNEL_OPENS);
		await expect(t.action(internal.slack.sync.syncBedpresChannels, {})).rejects.toThrow(
			/sync channel C1: Slack chat.postMessage failed: channel_not_found/,
		);
		expect(slack.messages("C2")).toHaveLength(1);
	});

	it("stops syncing a channel that was archived by hand in Slack", async () => {
		const { t, companyId } = await setup();
		fakeSlack({
			fail: ({ method }) => (method === "chat.postMessage" ? "is_archived" : undefined),
		});
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});

		await sync(t, CHANNEL_OPENS);
		expect(await channelRow(t, eventId)).toMatchObject({ status: "archived" });
	});

	it("ignores members who are already in the channel", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack({
			users: { "leder@uio.no": "U1" },
			fail: ({ method }) => (method === "conversations.invite" ? "already_in_channel" : undefined),
		});
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		const userId = await addOrganizer(t, eventId, "leder@uio.no", "hovedansvarlig");

		await sync(t, CHANNEL_OPENS);
		expect((await channelRow(t, eventId))?.invitedUserIds).toEqual([userId]);
		expect(slack.messages().at(-1)).toBe("Lagt til i kanalen: <@U1> (hovedansvarlig)");
	});

	it.each([
		["conversations.invite", "missing_scope", /conversations.invite failed: missing_scope/],
		["users.lookupByEmail", 429, /users.lookupByEmail failed: http_429/],
	])("retries the next run when %s fails", async (failing, failure, message) => {
		const { t, companyId } = await setup();
		fakeSlack({
			users: { "leder@uio.no": "U1" },
			fail: ({ method }) => (method === failing ? failure : undefined),
		});
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		await addOrganizer(t, eventId, "leder@uio.no", "hovedansvarlig");

		vi.setSystemTime(CHANNEL_OPENS);
		await expect(t.action(internal.slack.sync.syncBedpresChannels, {})).rejects.toThrow(message);
		expect((await channelRow(t, eventId))?.invitedUserIds).toEqual([]);
	});

	it("says goodbye only once when archiving has to be retried", async () => {
		const { t, companyId } = await setup();
		let archiveFails = true;
		const slack = fakeSlack({
			fail: ({ method }) =>
				method === "conversations.archive" && archiveFails ? "missing_scope" : undefined,
		});
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		await sync(t, CHANNEL_OPENS);

		vi.setSystemTime(EVENT_START + 4 * DAY_IN_MS);
		await expect(t.action(internal.slack.sync.syncBedpresChannels, {})).rejects.toThrow(
			/conversations.archive failed: missing_scope/,
		);
		archiveFails = false;
		await sync(t, EVENT_START + 4 * DAY_IN_MS + HOUR_IN_MS);
		expect(slack.messages().filter((text) => text === ARCHIVE_MESSAGE)).toHaveLength(1);
		expect(await channelRow(t, eventId)).toMatchObject({ status: "archived" });
	});

	it("does not retry other names when channel creation fails", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack({
			fail: ({ method }) => (method === "conversations.create" ? "restricted_action" : undefined),
		});
		await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});

		vi.setSystemTime(CHANNEL_OPENS);
		await expect(t.action(internal.slack.sync.syncBedpresChannels, {})).rejects.toThrow(
			/restricted_action/,
		);
		expect(slack.calls).toHaveLength(1);
	});

	it("gives up when every channel name is taken", async () => {
		const { t, companyId } = await setup();
		fakeSlack({
			fail: ({ method }) => (method === "conversations.create" ? "name_taken" : undefined),
		});
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});

		vi.setSystemTime(CHANNEL_OPENS);
		await expect(t.action(internal.slack.sync.syncBedpresChannels, {})).rejects.toThrow(
			`No free Slack channel name for event ${eventId}`,
		);
	});

	it("tolerates a deleted company or organizer user", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		const userId = await addOrganizer(t, eventId, "borte@uio.no", "medhjelper");
		await t.run(async (ctx) => {
			await ctx.db.delete(companyId);
			await ctx.db.delete(userId);
		});

		await sync(t, CHANNEL_OPENS);
		expect(slack.messages()).toEqual([expect.stringContaining("med bedriften,")]);
	});

	it("ignores progress for a channel that no longer exists", async () => {
		const { t, companyId } = await setup();
		fakeSlack();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		await sync(t, CHANNEL_OPENS);
		const channel = await channelRow(t, eventId);
		if (!channel) throw new Error("channel was not created");
		await t.run((ctx) => ctx.db.delete(channel._id));

		await t.mutation(internal.slack.channels.recordProgress, {
			channelId: channel._id,
			archived: true,
		});
		expect(await channelRow(t, eventId)).toBeNull();
	});

	it("adds observers silently to every channel once", async () => {
		const { t, companyId } = await setup();
		vi.stubEnv("SLACK_OBSERVER_EMAILS", " styret@uio.no, ukjent@uio.no ,");
		const slack = fakeSlack({ users: { "styret@uio.no": "U7" } });
		await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});
		await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START + HOUR_IN_MS,
		});

		await sync(t, CHANNEL_OPENS);
		const invites = slack.calls.filter((call) => call.method === "conversations.invite");
		expect(invites.map((call) => call.params)).toEqual([
			{ channel: "C1", users: "U7", force: "true" },
			{ channel: "C2", users: "U7", force: "true" },
		]);
		// Looked up once per run, and never announced in the channel.
		expect(slack.calls.filter((call) => call.method === "users.lookupByEmail")).toHaveLength(2);
		expect(slack.messages()).toHaveLength(1);

		slack.reset();
		await sync(t, CHANNEL_OPENS + HOUR_IN_MS);
		expect(slack.calls).toEqual([]);
	});

	it("does nothing when disabled or without a token", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		await insertEvent(t, companyId, {
			registrationOpens: REGISTRATION_OPENS,
			eventStart: EVENT_START,
		});

		featureFlags.slackBot.enabled = false;
		await sync(t, CHANNEL_OPENS);
		featureFlags.slackBot.enabled = true;
		vi.stubEnv("SLACK_BOT_TOKEN", "");
		await sync(t, CHANNEL_OPENS);
		expect(slack.calls).toEqual([]);
	});
});

describe("bedpres Slack copy", () => {
	const EVENT = {
		title: "Bedpres",
		company: "Testbedrift",
		eventStart: EVENT_START,
		registrationOpens: REGISTRATION_OPENS,
	};

	it("keeps channel names within Slack's limit", () => {
		const event = {
			title: "",
			company: "Æøå ".repeat(40),
			eventStart: EVENT_START,
			registrationOpens: REGISTRATION_OPENS,
		};
		expect(channelName(event, 3)).toHaveLength(80);
		expect(channelName(event, 3)).toMatch(/^2026-10-22-aeoa-.*-3$/);
	});

	it("renders every reminder without em-dashes", () => {
		for (const reminder of REMINDERS) {
			expect(reminder.text(EVENT)).not.toContain("\u2014");
			expect(reminder.at(EVENT)).toBeLessThan(EVENT_START + DAY_IN_MS);
		}
	});

	it("sends nothing before the first reminder", () => {
		expect(dueReminders(EVENT, CHANNEL_OPENS, [])).toEqual({ post: null, handled: [] });
	});
});
