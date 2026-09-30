import {
	COMPANY_FIRST_CONTACT_TEMPLATE_URL,
	EVENT_EXPENSE_TEMPLATE_URL,
} from "@workspace/shared/constants";
import { DAY_MS, eventPlanningAt } from "@workspace/shared/time";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	insertEvent,
	insertOrganizer,
	insertUser,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { recordReminderSent } from "../reminders/delivery";
import { welcomeMessage } from "./messages";
import { queueEventNotification } from "./state";

const START = Date.parse("2026-10-29T15:15:00Z");
const NOW = eventPlanningAt(START, 35);
type Channel = {
	id: string;
	name: string;
	creator: string;
	is_private: boolean;
	purpose: { value: string };
	archived: boolean;
	members: string[];
	messages: { text: string; client_msg_id: string }[];
};
function fakeSlack() {
	const channels: Channel[] = [];
	let fail: string | undefined;
	let loseCreate = false;
	let losePost = false;
	const calls: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init: RequestInit) => {
			const method = url.split("/").at(-1) as string;
			const args = Object.fromEntries(new URLSearchParams(init.body as string));
			calls.push(method);
			const reply = (data: object) => new Response(JSON.stringify(data));
			if (method === fail) return reply({ ok: false, error: "missing_scope" });
			const channel = channels.find((c) => c.id === args.channel);
			switch (method) {
				case "auth.test":
					return reply({ ok: true, user_id: "BOT" });
				case "conversations.create": {
					if (channels.some((c) => c.name === args.name))
						return reply({ ok: false, error: "name_taken" });
					const created = {
						id: `C${channels.length + 1}`,
						name: args.name as string,
						creator: "BOT",
						is_private: true,
						purpose: { value: "" },
						archived: false,
						members: ["BOT"],
						messages: [],
					};
					channels.push(created);
					if (loseCreate) {
						loseCreate = false;
						throw new Error("lost create response");
					}
					return reply({ ok: true, channel: created });
				}
				case "conversations.list":
					return reply({ ok: true, channels });
				case "conversations.members":
					return reply({ ok: true, members: channel?.members });
				case "conversations.history":
					return reply({ ok: true, messages: channel?.messages });
				case "conversations.rename":
					if (channel) channel.name = args.name as string;
					break;
				case "conversations.setPurpose":
					if (channel) channel.purpose.value = args.purpose as string;
					break;
				case "conversations.invite":
					if (channel) channel.members.push(args.users as string);
					break;
				case "conversations.kick":
					if (channel) channel.members = channel.members.filter((id) => id !== args.user);
					break;
				case "conversations.archive":
					if (channel) channel.archived = true;
					break;
				case "conversations.unarchive":
					if (channel) channel.archived = false;
					break;
				case "chat.postMessage":
					if (channel?.archived) return reply({ ok: false, error: "is_archived" });
					channel?.messages.push({
						text: args.text as string,
						client_msg_id: args.client_msg_id as string,
					});
					if (losePost) {
						losePost = false;
						throw new Error("lost post response");
					}
					break;
			}
			return reply({ ok: true });
		}),
	);
	return {
		channels,
		calls,
		fail: (method?: string) => {
			fail = method;
		},
		loseCreate: () => {
			loseCreate = true;
		},
		losePost: () => {
			losePost = true;
		},
	};
}
async function organizer(
	t: TestBackend,
	eventId: Id<"events">,
	slackUserId: string,
	role: "hovedansvarlig" | "medhjelper" = "hovedansvarlig",
) {
	const user = await insertUser(t, `${slackUserId}@uio.no`);
	await insertOrganizer(t, eventId, user._id, role);
	await t.run((ctx) =>
		ctx.db.insert("memberAccounts", {
			userId: user._id,
			workspaceEmail: `${slackUserId}@ifinavet.no`,
			firstName: "Test",
			lastName: "Person",
			group: "Bedrift",
			stage: "active",
			google: "created",
			slackUserId,
			updatedAt: NOW,
		}),
	);
	return user._id;
}
async function run(t: TestBackend, now = Date.now()) {
	vi.setSystemTime(now);
	await t.action(internal.events.slack.lifecycle.reconcile, {});
}
beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	vi.stubEnv("SLACK_EVENT_CHANNELS_ENABLED", "true");
	vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("company semester event lifecycle", () => {
	it("catches up four upcoming events, shares company channels and welcomes each once after reenabling", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		for (let index = 0; index < 4; index++) {
			const id = await insertEvent(t, companyId, {
				title: `Event ${index}`,
				eventStart: START - index * DAY_MS,
				registrationOpens: START - 7 * DAY_MS,
			});
			await organizer(t, id, `U${index}`);
		}
		vi.stubEnv("SLACK_EVENT_CHANNELS_ENABLED", "false");
		await run(t);
		expect(slack.calls).toEqual([]);
		vi.stubEnv("SLACK_EVENT_CHANNELS_ENABLED", "true");
		await run(t);
		expect(slack.channels).toHaveLength(1);
		expect(slack.channels[0]?.name).toBe("h26-testbedrift");
		expect(slack.channels[0]?.messages).toHaveLength(4);
		expect(slack.channels[0]?.members).toEqual(["BOT", "U3", "U2", "U1", "U0"]);
		await run(t);
		vi.stubEnv("SLACK_EVENT_CHANNELS_ENABLED", "false");
		await run(t);
		vi.stubEnv("SLACK_EVENT_CHANNELS_ENABLED", "true");
		await run(t);
		expect(slack.channels[0]?.messages).toHaveLength(4);
		for (let index = 0; index < 4; index++)
			expect(slack.channels[0]?.messages.some((m) => m.text.includes(`Event ${index}`))).toBe(true);
	});
	it("waits until five weeks, responds to rescheduling and skips external/deleted events", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, { eventStart: START + DAY_MS });
		await insertEvent(t, companyId, { eventStart: START, externalEvent: true });
		await run(t);
		expect(slack.channels).toHaveLength(0);
		await t.run((ctx) => ctx.db.patch(eventId, { eventStart: START }));
		await run(t);
		expect(slack.channels).toHaveLength(1);
		await t.run((ctx) => ctx.db.delete(eventId));
		await run(t);
		expect(slack.channels[0]?.archived).toBe(true);
	});
	it("sends only fresh four-week contact and main-organizer practical/expense reminders", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, { title: "Bedpres", eventStart: START });
		await organizer(t, eventId, "LEAD");
		await organizer(t, eventId, "HELPER", "medhjelper");
		await run(t);
		await run(t, eventPlanningAt(START, 28));
		expect(slack.channels[0]?.messages.at(-1)?.text).toContain(COMPANY_FIRST_CONTACT_TEMPLATE_URL);
		await run(t, eventPlanningAt(START, 2));
		const practical = slack.channels[0]?.messages.at(-1)?.text;
		expect(practical).toContain("<@LEAD>");
		expect(practical).not.toContain("<@HELPER>");
		expect(practical).toContain("laptop");
		expect(practical).not.toContain("penn");
		await run(t, eventPlanningAt(START, -1));
		expect(slack.channels[0]?.messages.at(-1)?.text).toContain(EVENT_EXPENSE_TEMPLATE_URL);
		const count = slack.channels[0]?.messages.length;
		await run(t);
		expect(slack.channels[0]?.messages).toHaveLength(count as number);
	});
	it("does not burst missed reminders on late enable", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		await insertEvent(t, companyId, { eventStart: START });
		await run(t, START - DAY_MS);
		expect(slack.channels[0]?.messages).toHaveLength(1);
		expect(slack.channels[0]?.messages[0]?.text).toContain("Dette gjør dere");
	});
	it("reconciles membership across all events and removes users whose role or account disappeared", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const first = await insertEvent(t, companyId, { eventStart: START });
		const second = await insertEvent(t, companyId, { eventStart: START + DAY_MS });
		const userId = await organizer(t, first, "FIRST");
		await organizer(t, second, "SECOND");
		await run(t);
		await t.run(async (ctx) => {
			const row = await ctx.db
				.query("eventOrganizers")
				.withIndex("by_eventId_and_userId", (q) => q.eq("eventId", first).eq("userId", userId))
				.unique();
			if (row) await ctx.db.delete(row._id);
		});
		await run(t);
		expect(slack.channels[0]?.members).toEqual(["BOT", "SECOND"]);
	});
	it("archives a week after the last event, and reuses the archived channel for new work", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		await insertEvent(t, companyId, { eventStart: START });
		const last = START + 14 * DAY_MS;
		await insertEvent(t, companyId, { eventStart: last });
		await run(t);
		await run(t, eventPlanningAt(START, -7));
		expect(slack.channels[0]?.archived).toBe(false);
		await run(t, last + 7 * DAY_MS);
		expect(slack.channels[0]?.archived).toBe(true);
		await insertEvent(t, companyId, { eventStart: last + 20 * DAY_MS });
		await run(t);
		expect(slack.channels).toHaveLength(1);
		expect(slack.channels[0]?.archived).toBe(false);
	});
	it("recovers a lost create response and a lost post response without duplicate channel or message", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		vi.spyOn(console, "error").mockImplementation(() => {});
		await insertEvent(t, companyId, { eventStart: START });
		slack.loseCreate();
		await expect(run(t)).rejects.toThrow("failed to reconcile");
		slack.losePost();
		await expect(run(t, NOW + DAY_MS)).rejects.toThrow("failed to reconcile");
		await run(t, NOW + 2 * DAY_MS);
		expect(slack.channels).toHaveLength(1);
		expect(slack.channels[0]?.messages).toHaveLength(1);
	});
	it("keeps failed invites retryable, limits retry frequency and reports the failure once", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		vi.spyOn(console, "error").mockImplementation(() => {});
		const eventId = await insertEvent(t, companyId, { eventStart: START });
		await organizer(t, eventId, "U1");
		slack.fail("conversations.invite");
		await expect(run(t)).rejects.toThrow();
		const calls = slack.calls.length;
		await run(t);
		expect(slack.calls).toHaveLength(calls);
		slack.fail();
		await run(t, NOW + DAY_MS);
		expect(slack.channels[0]?.members).toContain("U1");
		expect(slack.channels[0]?.messages).toHaveLength(1);
	});
	it("rechecks date/company/settings before dispatch and cancels stale notices", async () => {
		const { t, companyId } = await setup();
		fakeSlack();
		const eventId = await insertEvent(t, companyId, { eventStart: START });
		await run(t);
		await t.run((ctx) => queueEventNotification(ctx, eventId, "registration-full", "Fullt"));
		const channel = await t.run((ctx) => ctx.db.query("companySemesterSlackChannels").unique());
		if (!channel) throw new Error("Channel missing");
		const notice = await t.run((ctx) =>
			ctx.db
				.query("eventSlackNotifications")
				.withIndex("by_eventId_and_key", (q) =>
					q.eq("eventId", eventId).eq("key", "registration-full"),
				)
				.unique(),
		);
		if (!notice) throw new Error("Notice missing");
		await t.run((ctx) => ctx.db.patch(eventId, { eventStart: START + DAY_MS }));
		expect(
			await t.mutation(internal.events.slack.state.notification, {
				channelId: channel._id,
				notificationId: notice._id,
				now: NOW,
			}),
		).toBeNull();
		expect((await t.run((ctx) => ctx.db.get(notice._id)))?.cancelledAt).toBe(NOW);
	});
	it("serializes overlapping workers with a channel lease", async () => {
		const { t, companyId } = await setup();
		fakeSlack();
		await insertEvent(t, companyId, { eventStart: START });
		await t.mutation(internal.events.slack.state.discover, {
			now: NOW,
			paginationOpts: { cursor: null, numItems: 50 },
		});
		const channel = await t.run((ctx) => ctx.db.query("companySemesterSlackChannels").unique());
		if (!channel) throw new Error("Channel missing");
		expect(
			await t.mutation(internal.events.slack.state.claim, { channelId: channel._id, token: "a" }),
		).not.toBeNull();
		expect(
			await t.mutation(internal.events.slack.state.claim, { channelId: channel._id, token: "b" }),
		).toBeNull();
	});
	it("produces one batch notice only after provider-confirmed reminder sending, including partial batches", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: START, remindersEnabled: true });
		const user = await insertUser(t, "recipient@uio.no");
		await t.run((ctx) =>
			ctx.db.insert("eventReminderDeliveries", {
				eventId,
				userId: user._id,
				kind: "week",
				emailId: "email1",
				sent: false,
			}),
		);
		await t.run((ctx) => recordReminderSent(ctx, "email1", "email.queued"));
		expect(await t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(0);
		await t.run((ctx) => recordReminderSent(ctx, "email1", "email.sent"));
		await t.run((ctx) => recordReminderSent(ctx, "email1", "email.delivered"));
		expect(await t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(1);
	});
	it("welcome includes actual dates and enabled work only, including across DST", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: START - 7 * DAY_MS,
			remindersEnabled: true,
			feedbackEnabled: true,
		});
		const event = await t.run((ctx) => ctx.db.get(eventId));
		if (!event) throw new Error("Event missing");
		const text = welcomeMessage(event, NOW);
		expect(text).toContain("Dette gjør jeg");
		expect(text).toContain("Dette gjør dere");
		expect(text).toContain("30. oktober, 08:00");
		expect(text).toContain("godkjent");
		const disabled = welcomeMessage(
			{ ...event, remindersEnabled: false, feedbackEnabled: false },
			NOW,
		);
		expect(disabled).not.toContain("tilbakemeldingsskjemaet");
		expect(disabled).not.toContain("Sender påminnelse");
		expect(eventPlanningAt(START, 35)).toBe(Date.parse("2026-09-24T07:00:00Z"));
		expect(eventPlanningAt(START, 2)).toBe(Date.parse("2026-10-27T08:00:00Z"));
	});
});

function emailEvent(id: string, type: "email.sent" | "email.delivered" = "email.sent") {
	return {
		id: id as import("@convex-dev/resend").EmailId,
		event: {
			type,
			created_at: new Date().toISOString(),
			data: {
				email_id: id,
				created_at: new Date().toISOString(),
				from: "info@ifinavet.no",
				to: ["test@example.test"],
				subject: "Test",
			},
		},
	};
}

it("uses provider callbacks once per feedback round and ignores cancelled/missing campaigns", async () => {
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	const campaignId = await t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			status: "open",
			opensAt: NOW,
			closesAt: START,
			generation: 1,
		}),
	);
	const inviteId = await t.run((ctx) =>
		ctx.db.insert("feedbackInvites", {
			campaignId,
			responded: false,
			bounced: false,
			complained: false,
			delivered: false,
			sent: false,
		}),
	);
	for (const round of [0, 3, 7, 11]) {
		const id = `round-${round}`;
		await t.run((ctx) =>
			ctx.db.insert("feedbackDeliveries", {
				campaignId,
				inviteId,
				round,
				emailId: id,
				queuedAt: NOW,
			}),
		);
		await t.mutation(internal.feedback.delivery.messages.onEmailEvent, emailEvent(id));
		await t.mutation(
			internal.feedback.delivery.messages.onEmailEvent,
			emailEvent(id, "email.delivered"),
		);
	}
	expect(await t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(4);
	await t.run((ctx) => ctx.db.patch(campaignId, { status: "cancelled" }));
	await t.mutation(internal.feedback.delivery.messages.onEmailEvent, emailEvent("round-3"));
	await t.run((ctx) => ctx.db.delete(campaignId));
	await t.mutation(internal.feedback.delivery.messages.onEmailEvent, emailEvent("round-7"));
	expect(await t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(4);
	const user = await insertUser(t, "reminder@uio.no");
	await t.run((ctx) =>
		ctx.db.insert("eventReminderDeliveries", {
			eventId,
			userId: user._id,
			kind: "twoDays",
			emailId: "event-reminder",
			sent: false,
		}),
	);
	await t.mutation(internal.feedback.delivery.messages.onEmailEvent, emailEvent("event-reminder"));
	expect(await t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(5);
});

it("keeps the channel through report approval and queueing, then archives a week after confirmed sending", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START, feedbackEnabled: true });
	await run(t);
	const campaignId = await t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			status: "closed",
			opensAt: START + DAY_MS,
			closesAt: START + 15 * DAY_MS,
			generation: 1,
		}),
	);
	const reportId = await t.run((ctx) =>
		ctx.db.insert("feedbackReports", {
			campaignId,
			eventId,
			eventTitle: "Bedpres",
			eventStart: START,
			companyName: "Testbedrift",
			recipientEmail: "test@example.test",
			status: "approved",
			questions: [],
			totalResponses: 1,
			buildCursor: null,
			revision: 1,
			retentionAt: START + 365 * DAY_MS,
			emailId: "report",
			deliveryStatus: "queued",
		}),
	);
	const sentAt = START + 20 * DAY_MS;
	await run(t, sentAt);
	expect(slack.channels[0]?.archived).toBe(false);
	await t.mutation(internal.feedback.delivery.messages.onEmailEvent, emailEvent("report"));
	await run(t);
	expect(slack.channels[0]?.messages.at(-1)?.text).toContain("sendt tilbakemeldingsrapporten");
	await run(t, sentAt + 7 * DAY_MS - 1);
	expect(slack.channels[0]?.archived).toBe(false);
	await run(t, sentAt + 7 * DAY_MS);
	expect(slack.channels[0]?.archived).toBe(true);
	await t.run((ctx) => ctx.db.patch(reportId, { deliveryStatus: "failed" }));
	await run(t);
	expect(slack.channels[0]?.archived).toBe(false);
});

it("routes a company change to its new shared channel and cleans up the old one", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	const other = await t.run(async (ctx) => {
		const company = await ctx.db.get(companyId);
		if (!company) throw new Error("company missing");
		const { _id, _creationTime, ...fields } = company;
		return ctx.db.insert("companies", { ...fields, name: "Other" });
	});
	await t.run((ctx) => ctx.db.patch(eventId, { hostingCompany: other }));
	await run(t);
	expect(slack.channels).toHaveLength(2);
	expect(slack.channels[0]?.archived).toBe(true);
	expect(slack.channels[1]?.name).toBe("h26-other");
	expect(slack.channels[1]?.messages).toHaveLength(1);
});

it("fans out an existing unregister-wave detection without a second detector or duplicate occurrence", async () => {
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId, {
		eventStart: START,
		registrationOpens: NOW - DAY_MS,
		participationLimit: 10,
	});
	const user = await insertUser(t, "student@uio.no");
	await t.run(async (ctx) => {
		for (let n = 0; n < 5; n++)
			await ctx.db.insert("registrationLog", {
				eventId,
				userId: user._id,
				change: "unregistered",
				fromStatus: "registered",
				at: NOW - n * 1000,
			});
	});
	await t.mutation(internal.engagement.alerts.detectAlerts, {});
	await t.mutation(internal.engagement.alerts.detectAlerts, {});
	const notices = await t.run((ctx) => ctx.db.query("eventSlackNotifications").collect());
	expect(notices).toHaveLength(1);
	expect(notices[0]?.key).toContain("unregister-wave:");
});
