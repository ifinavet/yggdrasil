import {
	COMPANY_FIRST_CONTACT_TEMPLATE_URL,
	EVENT_EXPENSE_TEMPLATE_URL,
} from "@workspace/shared/constants";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { DAY_MS, eventPlanningAt } from "@workspace/shared/time";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	insertEvent as insertFixtureEvent,
	insertOrganizer,
	insertRegistration,
	insertUser,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { followupFinishedAt } from "../../feedback/reports/lifecycle";
import { slackClient } from "../../iam/slack";
import { recordReminderSent } from "../reminders/delivery";
import { welcomeMessage } from "./messages";
import { queueEventNotification } from "./state";

const START = Date.parse("2026-10-29T15:15:00Z");
const NOW = eventPlanningAt(START, 35);
// These lifecycle fixtures open registration two weeks before the event unless overridden.
const insertEvent: typeof insertFixtureEvent = (t, companyId, overrides = {}) =>
	insertFixtureEvent(t, companyId, {
		registrationOpens: eventPlanningAt(overrides.eventStart ?? START, 14),
		...overrides,
	});
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
	const systemMessages: { text: string; client_msg_id: string }[] = [];
	let fail: string | undefined;
	let failureCode = "missing_scope";
	let loseCreate = false;
	let losePost = false;
	let rejectedText: string | undefined;
	const calls: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init: RequestInit) => {
			const method = url.split("/").at(-1) as string;
			const args = Object.fromEntries(new URLSearchParams(init.body as string));
			calls.push(method);
			const reply = (data: object) => new Response(JSON.stringify(data));
			if (method === fail) return reply({ ok: false, error: failureCode });
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
				case "conversations.info":
					return reply({ ok: true, channel: { ...channel, is_archived: channel?.archived } });
				case "conversations.members":
					return reply({ ok: true, members: channel?.members });
				case "conversations.history":
					return reply({
						ok: true,
						messages: args.channel === SYSTEM_ALERTS_CHANNEL ? systemMessages : channel?.messages,
					});
				case "conversations.rename":
					if (channels.some((item) => item.id !== args.channel && item.name === args.name))
						return reply({ ok: false, error: "name_taken" });
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
					return reply({ ok: false, error: "not_allowed_token_type" });
				case "chat.postMessage":
					if (rejectedText && args.text?.includes(rejectedText))
						return reply({ ok: false, error: "internal_error" });
					if (channel?.archived) return reply({ ok: false, error: "is_archived" });
					channel?.messages.push({
						text: args.text as string,
						client_msg_id: args.client_msg_id as string,
					});
					if (args.channel === SYSTEM_ALERTS_CHANNEL)
						systemMessages.push({
							text: args.text as string,
							client_msg_id: args.client_msg_id as string,
						});
					if (losePost && channel) {
						losePost = false;
						throw new Error("lost post response");
					}
					break;
			}
			return reply({ ok: true });
		}),
	);
	return {
		rejectText: (text?: string) => {
			rejectedText = text;
		},
		systemMessages,
		channels,
		calls,
		fail: (method?: string, code = "missing_scope") => {
			fail = method;
			failureCode = code;
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
		vi.stubEnv("SLACK_BOT_TOKEN", "");
		await run(t);
		expect(slack.calls).toEqual([]);
		vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
		await run(t);
		expect(slack.channels).toHaveLength(1);
		expect(slack.channels[0]?.name).toBe("h26-testbedrift");
		expect(slack.channels[0]?.messages).toHaveLength(4);
		expect(slack.channels[0]?.members).toEqual(["BOT", "U3", "U2", "U1", "U0"]);
		await run(t);
		vi.stubEnv("SLACK_BOT_TOKEN", "");
		await run(t);
		vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
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
	it("links preparation and sends main-organizer practical/expense reminders", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, { title: "Bedpres", eventStart: START });
		await organizer(t, eventId, "LEAD");
		await organizer(t, eventId, "HELPER", "medhjelper");
		await run(t);
		await run(t, eventPlanningAt(START, 28));
		expect(slack.channels[0]?.messages.map((m) => m.text).join("\n")).toContain(
			"?planning=prepare",
		);
		await run(t, eventPlanningAt(START, 2));
		const practical = slack.channels[0]?.messages.find((message) =>
			message.text.includes("laptop"),
		)?.text;
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
	it("greets by name without tagging when the notice only informs", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, { eventStart: START, participationLimit: 1 });
		await organizer(t, eventId, "LEAD");
		await run(t);
		const user = await insertUser(t, "full@example.test");
		await insertRegistration(t, eventId, user._id, "registered");
		await t.run((ctx) => queueEventNotification(ctx, eventId, "registration-full", "Fullt"));
		await run(t);
		const full = slack.channels[0]?.messages.find((message) => message.text.includes("Fullt"));
		expect(slack.channels[0]?.messages[0]?.text).toContain("Halla <@LEAD>!");
		expect(full?.text).toMatch(/^Halla [^<]+!\n/);
		expect(full?.text).not.toContain("<@");
	});
	it("recovers still-actionable reminders on late enable", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		await insertEvent(t, companyId, { eventStart: START });
		await run(t, START - DAY_MS);
		const texts = slack.channels[0]?.messages.map((message) => message.text).join("\n");
		expect(texts).toContain("Dette gjør dere");
		expect(texts).toContain("?planning=prepare");
		expect(texts).toContain("laptop");
		expect(texts).not.toContain("del arrangementet i Ifi-studenter");
		const count = slack.channels[0]?.messages.length;
		await run(t);
		expect(slack.channels[0]?.messages).toHaveLength(count as number);
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
	it("archives a week after the last event, and replaces the archived channel for new work", async () => {
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
		expect(slack.channels).toHaveLength(2);
		expect(slack.channels[0]?.archived).toBe(true);
		expect(slack.channels[1]?.archived).toBe(false);
		expect(slack.calls).not.toContain("conversations.unarchive");
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
	it("keeps failed invites retryable without blocking messages", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		vi.spyOn(console, "error").mockImplementation(() => {});
		const eventId = await insertEvent(t, companyId, { eventStart: START });
		await organizer(t, eventId, "U1");
		slack.fail("conversations.invite");
		await expect(run(t)).rejects.toThrow();
		await expect(run(t)).rejects.toThrow();
		expect(slack.channels[0]?.messages).toHaveLength(1);
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
				eventStart: START,
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
	const eventId = await insertEvent(t, companyId, { eventStart: START, remindersEnabled: true });
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
			eventStart: START,
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
	expect(slack.channels[1]?.archived).toBe(false);
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

it("keeps manually invited support members while removing formerly managed organizers", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	const user = await organizer(t, eventId, "MANAGED");
	await run(t);
	slack.channels[0]?.members.push("MANUAL");
	await t.run(async (ctx) => {
		const account = await ctx.db
			.query("memberAccounts")
			.withIndex("by_userId", (q) => q.eq("userId", user))
			.unique();
		if (account) await ctx.db.patch(account._id, { stage: "offboarded" });
	});
	await run(t);
	expect(slack.channels[0]?.members).toContain("MANUAL");
	expect(slack.channels[0]?.members).not.toContain("MANAGED");
});

it("rechecks conditional text/promotion/checklist reminders and avoids completed work", async () => {
	const { dueOrganizerReminders } = await import("./reminders");
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId, {
		eventStart: START,
		registrationOpens: eventPlanningAt(START, 13),
		title: "TBD",
		teaser: "<p>TBD</p>",
		description: "<p>&nbsp;</p>",
	});
	const due = async (now: number) =>
		t.run(async (ctx) => {
			const event = await ctx.db.get(eventId);
			if (!event) throw new Error("Missing event");
			return dueOrganizerReminders(ctx, event, now);
		});
	const missing = await due(eventPlanningAt(START, 14));
	expect(missing.map((r) => r.key)).toContain("missing-text");
	expect(missing.some((r) => r.key.startsWith("promotion:"))).toBe(false);
	expect(missing.find((notice) => notice.key === "missing-text")?.text).not.toContain("/edit");
	await t.run((ctx) =>
		ctx.db.patch(eventId, { title: "Bedpres", teaser: "Lær", description: "Mer om bedriften" }),
	);
	expect((await due(eventPlanningAt(START, 14))).some((r) => r.key.startsWith("promotion:"))).toBe(
		true,
	);
	await t.run((ctx) =>
		ctx.db.patch(eventId, {
			completedChecklistSteps: ["promotion", "room", "food", "helpers", "company-contact"],
		}),
	);
	expect(await due(eventPlanningAt(START, 14))).toEqual([]);
	expect(await due(eventPlanningAt(START, 7))).toEqual([]);
	expect(await due(eventPlanningAt(START, 28))).toEqual([]);
	await t.run((ctx) => ctx.db.patch(eventId, { completedChecklistSteps: ["room"] }));
	const checklist = await due(eventPlanningAt(START, 7));
	expect(checklist.find((notice) => notice.key === "unfinished-checklist")?.text).toContain(
		"matbestilling",
	);
	expect(checklist.find((notice) => notice.key === "unfinished-checklist")?.text).not.toContain(
		"bekreft rom",
	);
});

it("asks organizers to review the reminder email and nags until it is sent", async () => {
	const { dueOrganizerReminders } = await import("./reminders");
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId, {
		eventStart: START,
		published: true,
		remindersEnabled: true,
	});
	const due = async (now: number) =>
		t.run(async (ctx) => {
			const event = await ctx.db.get(eventId);
			if (!event) throw new Error("Missing event");
			return (await dueOrganizerReminders(ctx, event, now)).filter((r) =>
				r.key.startsWith("reminder-review"),
			);
		});
	expect(await due(eventPlanningAt(START, 5))).toEqual([]);
	expect(await due(eventPlanningAt(START, 4))).toEqual([
		expect.objectContaining({
			key: "reminder-review",
			text: expect.stringContaining("klar til gjennomgang"),
		}),
	]);
	expect(await due(eventPlanningAt(START, 3))).toEqual([
		expect.objectContaining({
			key: "reminder-review:followup",
			text: expect.stringContaining("fortsatt ikke sendt"),
		}),
	]);
	expect(await due(START)).toEqual([]);
	await t.run((ctx) =>
		ctx.db.insert("eventReminders", { eventId, kind: "twoDays", queuedAt: START }),
	);
	expect(await due(eventPlanningAt(START, 3))).toEqual([]);
	await t.run(async (ctx) => {
		for (const row of await ctx.db.query("eventReminders").collect()) await ctx.db.delete(row._id);
		await ctx.db.patch(eventId, { remindersEnabled: false });
	});
	expect(await due(eventPlanningAt(START, 4))).toHaveLength(1);
	await t.run(async (ctx) => {
		await ctx.db.patch(eventId, { externalEvent: true });
	});
	expect(await due(eventPlanningAt(START, 4))).toEqual([]);
});

it("warns about unmarked attendance before and after feedback opens, and nudges only an unapproved report", async () => {
	const { dueOrganizerReminders } = await import("./reminders");
	const { feedbackOpensAt, feedbackRoundAt, HOUR_MS } = await import("@workspace/shared/time");
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId, { eventStart: START, feedbackEnabled: true });
	const user = await insertUser(t, "participant@uio.no");
	const registration = await t.run((ctx) =>
		ctx.db.insert("registrations", {
			eventId,
			userId: user._id,
			status: "registered",
			registrationTime: NOW,
		}),
	);
	const campaignId = await t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			status: "open",
			generation: 1,
			opensAt: feedbackOpensAt(START),
			closesAt: START + 15 * DAY_MS,
		}),
	);
	const due = async (now: number) =>
		t.run(async (ctx) => {
			const event = await ctx.db.get(eventId);
			if (!event) throw new Error("Missing event");
			return dueOrganizerReminders(ctx, event, now);
		});
	const opensAt = feedbackOpensAt(START);
	const attendance = async (now: number) =>
		(await due(now)).filter((notice) => notice.key.startsWith("missing-attendance"));
	expect(await attendance(opensAt - 2 * HOUR_MS)).toEqual([]);
	expect(await attendance(opensAt - HOUR_MS)).toMatchObject([
		{ key: "missing-attendance", text: expect.stringContaining("1 påmeldte") },
	]);
	expect((await attendance(opensAt - 1)).map((notice) => notice.key)).toEqual([
		"missing-attendance",
	]);
	expect(await attendance(opensAt)).toEqual([]);
	expect(await attendance(opensAt + 4 * HOUR_MS)).toMatchObject([
		{ key: "missing-attendance:followup-1", text: expect.stringContaining('"Ikke møtt"') },
	]);
	expect((await attendance(feedbackRoundAt(opensAt, 1))).map((notice) => notice.key)).toEqual([
		"missing-attendance:followup-2",
	]);
	expect(await attendance(feedbackRoundAt(opensAt, 2))).toMatchObject([
		{
			key: "missing-attendance:followup-3",
			text: expect.stringContaining("Siste påminnelse"),
		},
	]);
	expect(await attendance(feedbackRoundAt(opensAt, 3))).toMatchObject([
		{ key: "missing-attendance:followup-4", text: expect.stringContaining("robotkropp") },
	]);
	expect(await attendance(START + 15 * DAY_MS)).toEqual([]);
	await t.run((ctx) => ctx.db.patch(campaignId, { status: "closed" }));
	expect(await attendance(feedbackRoundAt(opensAt, 2))).toEqual([]);
	await t.run((ctx) => ctx.db.patch(campaignId, { status: "scheduled" }));
	expect(await attendance(opensAt + 4 * HOUR_MS)).toEqual([]);
	expect(await attendance(opensAt - HOUR_MS)).toHaveLength(1);
	await t.run((ctx) => ctx.db.patch(campaignId, { status: "open" }));
	await t.run((ctx) => ctx.db.patch(registration, { attendanceStatus: "no_show" }));
	expect(await attendance(opensAt - HOUR_MS)).toEqual([]);
	expect(await attendance(opensAt + 4 * HOUR_MS)).toEqual([]);
	const readyAt = START + 15 * DAY_MS;
	const reportId = await t.run((ctx) =>
		ctx.db.insert("feedbackReports", {
			campaignId,
			eventId,
			eventTitle: "Bedpres",
			eventStart: START,
			companyName: "Bedrift",
			recipientEmail: "",
			status: "draft",
			questions: [],
			totalResponses: 1,
			buildCursor: null,
			revision: 0,
			retentionAt: START + 365 * DAY_MS,
			readyAt,
		}),
	);
	expect((await due(eventPlanningAt(readyAt, -3)))[0]?.text).toContain(
		"venter fortsatt på gjennomgang",
	);
	await t.run((ctx) => ctx.db.patch(reportId, { status: "approved" }));
	expect(await due(eventPlanningAt(readyAt, -3))).toEqual([]);
});

it("does not send the retired manual first-contact template reminder", async () => {
	const { dueOrganizerReminders } = await import("./reminders");
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	const reminders = await t.run(async (ctx) =>
		dueOrganizerReminders(ctx, (await ctx.db.get(eventId))!, eventPlanningAt(START, 28)),
	);
	expect(
		reminders.some((reminder) => reminder.text.includes(COMPANY_FIRST_CONTACT_TEMPLATE_URL)),
	).toBe(false);
});

it("announces only actual channel creation to system alerts, once per generation", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	await run(t);
	expect(slack.systemMessages).toHaveLength(1);
	expect(slack.systemMessages[0]?.text).toContain("#h26-testbedrift");
	expect(slack.systemMessages[0]?.text).toContain("Testbedrift (høst 2026)");
	await t.run((ctx) => ctx.db.delete(eventId));
	await run(t);
	expect(slack.systemMessages).toHaveLength(1);
	await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	await run(t);
	expect(slack.systemMessages).toHaveLength(2);
	expect(slack.systemMessages[1]?.text).toContain("#h26-testbedrift-2");
});

it("recovers a replacement's lost create response without another generation or repeated milestones", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	vi.spyOn(console, "error").mockImplementation(() => {});
	const first = await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	await t.run((ctx) => ctx.db.delete(first));
	await run(t);
	await insertEvent(t, companyId, { eventStart: START });
	slack.loseCreate();
	await expect(run(t)).rejects.toThrow("failed to reconcile");
	await run(t, NOW + DAY_MS);
	await run(t);
	expect(slack.channels).toHaveLength(2);
	expect(slack.channels[0]?.archived).toBe(true);
	expect(slack.channels[1]?.name).toBe("h26-testbedrift-2");
	expect(slack.channels[1]?.messages).toHaveLength(1);
	expect(slack.systemMessages).toHaveLength(2);
});

it("reports missing IAM identities once and invites an organizer after IAM catches up", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	const userId = await organizer(t, eventId, "LATE");
	const account = await t.run((ctx) =>
		ctx.db
			.query("memberAccounts")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.unique(),
	);
	if (!account) throw new Error("Missing account");
	await t.run((ctx) => ctx.db.patch(account._id, { slackUserId: undefined }));
	await run(t);
	await run(t);
	expect(slack.channels[0]?.messages).toHaveLength(2);
	expect(slack.channels[0]?.members).not.toContain("LATE");
	await t.run((ctx) => ctx.db.patch(account._id, { slackUserId: "LATE" }));
	await run(t);
	expect(slack.channels[0]?.members).toContain("LATE");
	expect(slack.channels[0]?.messages).toHaveLength(2);
	expect(slack.systemMessages).toHaveLength(1);
});

it("recovers a message from metadata beyond twenty history pages and bounds lookup by its creation time", async () => {
	const fetch = vi.fn(async (_url: string, init: RequestInit) => {
		const args = Object.fromEntries(new URLSearchParams(init.body as string));
		expect(args.oldest).toBe(String((NOW - 1000) / 1000));
		const page = Number(args.cursor || 0);
		return new Response(
			JSON.stringify({
				ok: true,
				messages:
					page === 21
						? [
								{
									metadata: {
										event_type: "yggdrasil_event_notice",
										event_payload: { key: "notice" },
									},
								},
							]
						: [],
				response_metadata: { next_cursor: String(page + 1) },
			}),
		);
	});
	vi.stubGlobal("fetch", fetch);
	expect(await slackClient({ botToken: "test" }).hasMessage("C1", "notice", NOW)).toBe(true);
	expect(fetch).toHaveBeenCalledTimes(22);
});

it("preserves manual membership through a temporary organizer assignment", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	slack.channels[0]?.members.push("MANUAL");
	const userId = await organizer(t, eventId, "MANUAL");
	await run(t);
	await t.run(async (ctx) => {
		const row = await ctx.db
			.query("eventOrganizers")
			.withIndex("by_eventId_and_userId", (q) => q.eq("eventId", eventId).eq("userId", userId))
			.unique();
		if (row) await ctx.db.delete(row._id);
	});
	await run(t);
	expect(slack.channels[0]?.members).toContain("MANUAL");
});

it("welcomes once through date changes, and refreshes an unsent welcome after a missed event", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	await t.run((ctx) => ctx.db.patch(eventId, { eventStart: START }));
	await run(t);
	expect(slack.channels[0]?.messages).toHaveLength(1);
	const second = await insertEvent(t, companyId, { eventStart: START });
	const channel = await t.run((ctx) => ctx.db.query("companySemesterSlackChannels").unique());
	if (!channel) throw new Error("Missing channel");
	const context = await t.mutation(internal.events.slack.state.context, {
		channelId: channel._id,
		now: NOW,
	});
	const pending = context?.messages[0];
	if (!pending) throw new Error("Missing welcome");
	expect(
		await t.mutation(internal.events.slack.state.notification, {
			channelId: channel._id,
			notificationId: pending.id,
			now: START + 1,
		}),
	).toBeNull();
	await t.run((ctx) => ctx.db.patch(second, { eventStart: START + 2 * DAY_MS }));
	await run(t, START + 1);
	expect(
		slack.channels[0]?.messages.filter((message) => message.text.includes("Så hyggelig")),
	).toHaveLength(2);
});

it("allows a fresh full notification days after an unsent full notice was cancelled", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START, participationLimit: 1 });
	await run(t);
	await t.run((ctx) => queueEventNotification(ctx, eventId, "registration-full", "Fullt!"));
	await run(t);
	expect(slack.channels[0]?.messages).toHaveLength(1);
	vi.setSystemTime(NOW + 2 * DAY_MS);
	const user = await insertUser(t, "full@example.test");
	await insertRegistration(t, eventId, user._id, "registered");
	await t.run((ctx) => queueEventNotification(ctx, eventId, "registration-full", "Fullt!"));
	await run(t);
	expect(slack.channels[0]?.messages.at(-1)?.text).toContain("Fullt!");
});

it("waits for the five-week window before replacing an archived channel", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const first = await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	await t.run((ctx) => ctx.db.delete(first));
	await run(t);
	const later = START + 50 * DAY_MS;
	await insertEvent(t, companyId, { eventStart: later });
	const calls = slack.calls.length;
	await run(t);
	expect(slack.calls).toHaveLength(calls);
	expect(slack.channels).toHaveLength(1);
	expect(slack.channels[0]?.archived).toBe(true);
	await run(t, eventPlanningAt(later, 35));
	expect(slack.channels).toHaveLength(2);
});

it("uses the persisted feedback campaign time in a catch-up welcome", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START, feedbackEnabled: true });
	await t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			status: "scheduled",
			opensAt: Date.parse("2026-10-30T08:00:00Z"),
			closesAt: START + 15 * DAY_MS,
			generation: 1,
		}),
	);
	await run(t);
	expect(slack.channels[0]?.messages[0]?.text).toContain(
		"Sender tilbakemeldingsskjemaet til dem dere registrerer som møtt, fredag 30. oktober, 09:00.",
	);
});

it("finishes campaigns without a form and safely observes legacy or revoked reports", async () => {
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId, { eventStart: START, feedbackEnabled: true });
	const campaignId = await t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			status: "closed",
			opensAt: START + DAY_MS,
			closesAt: START + 15 * DAY_MS,
			closedAt: START + 15 * DAY_MS,
			generation: 1,
		}),
	);
	const completion = () =>
		t.run(async (ctx) => {
			const event = await ctx.db.get(eventId);
			if (!event) throw new Error("Missing event");
			return followupFinishedAt(ctx, event);
		});
	expect(await completion()).toBe(START + 15 * DAY_MS);
	const reportId = await t.run((ctx) =>
		ctx.db.insert("feedbackReports", {
			campaignId,
			eventId,
			eventTitle: "Report",
			eventStart: START,
			companyName: "Test",
			recipientEmail: "test@example.test",
			status: "approved",
			questions: [],
			totalResponses: 1,
			buildCursor: null,
			revision: 1,
			retentionAt: START + 365 * DAY_MS,
			deliveryStatus: "delivered",
		}),
	);
	expect(await completion()).toBe(NOW);
	vi.setSystemTime(NOW + DAY_MS);
	expect(await completion()).toBe(NOW);
	await t.run((ctx) =>
		ctx.db.patch(reportId, {
			status: "revoked",
			deliveryStatus: "failed",
			followupFinishedAt: NOW + DAY_MS,
		}),
	);
	expect(await completion()).toBe(NOW + DAY_MS);
});

it("cancels queued feedback and report notices when their source state changes", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START, feedbackEnabled: true });
	await run(t);
	const campaignId = await t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			status: "open",
			opensAt: START + DAY_MS,
			closesAt: START + 15 * DAY_MS,
			generation: 1,
		}),
	);
	await t.run((ctx) =>
		queueEventNotification(ctx, eventId, `feedback-sent:${campaignId}:0`, "Feedback sent"),
	);
	await t.run((ctx) => ctx.db.patch(eventId, { feedbackEnabled: false }));
	await run(t);
	expect(slack.channels[0]?.messages).toHaveLength(1);
	const reportId = await t.run((ctx) =>
		ctx.db.insert("feedbackReports", {
			campaignId,
			eventId,
			eventTitle: "Report",
			eventStart: START,
			companyName: "Test",
			recipientEmail: "test@example.test",
			status: "approved",
			questions: [],
			totalResponses: 1,
			buildCursor: null,
			revision: 1,
			retentionAt: START + 365 * DAY_MS,
			deliveryStatus: "pending",
			deliveryAttempt: 1,
		}),
	);
	await t.run(async (ctx) => {
		await queueEventNotification(ctx, eventId, `report-ready:${reportId}`, "Ready");
		await queueEventNotification(ctx, eventId, `report-sent:${reportId}:0`, "Old attempt sent");
	});
	await run(t);
	expect(slack.channels[0]?.messages).toHaveLength(1);
	await t.run(async (ctx) => {
		await ctx.db.patch(reportId, { followupFinishedAt: NOW, deliveryStatus: "queued" });
		await queueEventNotification(ctx, eventId, `report-sent:${reportId}:1`, "Current attempt sent");
	});
	await run(t);
	expect(slack.channels[0]?.messages).toHaveLength(2);
	expect(slack.channels[0]?.messages.at(-1)?.text).toContain("Current attempt sent");
});

it("recovers a desired name collision with a deterministic name and announces that actual name", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	slack.channels.push({
		id: "MANUAL",
		name: "h26-testbedrift",
		creator: "OTHER",
		is_private: true,
		purpose: { value: "Unrelated" },
		archived: false,
		members: [],
		messages: [],
	});
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	await organizer(t, eventId, "LEAD");
	await run(t);
	await run(t);
	expect(slack.channels[0]?.name).toBe("h26-testbedrift");
	expect(slack.channels[1]?.name).toMatch(/^h26-testbedrift-/);
	expect(slack.channels[1]?.members).toContain("LEAD");
	expect(slack.channels[1]?.messages).toHaveLength(1);
	expect(slack.systemMessages).toHaveLength(1);
	expect(slack.systemMessages[0]?.text).toContain(`#${slack.channels[1]?.name}`);
	expect(slack.calls).not.toContain("conversations.rename");
});

it.each([
	{ totalResponses: 0, tagged: false },
	{ totalResponses: 3, tagged: true },
])(
	"links and tags organizers only when the report has responses to review ($totalResponses)",
	async ({ totalResponses, tagged }) => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, { eventStart: START, feedbackEnabled: true });
		await organizer(t, eventId, "LEAD");
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
				eventTitle: "Report",
				eventStart: START,
				companyName: "Test",
				recipientEmail: "test@example.test",
				status: "draft",
				questions: [],
				totalResponses,
				buildCursor: null,
				revision: 1,
				retentionAt: START + 365 * DAY_MS,
			}),
		);
		await t.run((ctx) =>
			queueEventNotification(
				ctx,
				eventId,
				`report-ready:${reportId}`,
				"Ingen svarte denne gangen.",
			),
		);
		await run(t);
		const text = slack.channels[0]?.messages.at(-1)?.text;
		expect(text).toContain("Ingen svarte");
		expect(text?.includes("/report")).toBe(tagged);
		expect(text?.includes("<@LEAD>")).toBe(tagged);
	},
);

it("delivers welcome and archives without history permission, without repeating channel edits", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	await organizer(t, eventId, "LEAD");
	slack.fail("conversations.history");
	await run(t);
	await run(t, NOW + DAY_MS);
	expect(slack.channels[0]?.messages).toHaveLength(1);
	expect(slack.channels[0]?.messages[0]?.text).toContain("Halla");
	expect(slack.channels[0]?.purpose.value).toBe("Arrangementer med Testbedrift, høst 2026");
	expect(slack.systemMessages).toHaveLength(1);
	expect(slack.calls).not.toContain("conversations.rename");
	expect(slack.calls.filter((call) => call === "conversations.setPurpose")).toHaveLength(1);
	await t.run((ctx) => ctx.db.delete(eventId));
	await run(t);
	expect(slack.channels[0]?.archived).toBe(true);
	expect(slack.channels[0]?.messages).toHaveLength(2);
});

it("retries other history errors without marking an unsent welcome delivered", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	vi.spyOn(console, "error").mockImplementation(() => {});
	await insertEvent(t, companyId, { eventStart: START });
	slack.fail("conversations.history", "internal_error");
	await expect(run(t)).rejects.toThrow("failed to reconcile");
	expect(slack.channels[0]?.messages).toHaveLength(0);
	slack.fail();
	await run(t, NOW + DAY_MS);
	expect(slack.channels[0]?.messages).toHaveLength(1);
});

it("uses the stored ID after a manual rename and repairs changed channel descriptions", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	const channel = slack.channels[0];
	if (!channel) throw new Error("Missing channel");
	channel.name = "our-custom-name";
	const callsBefore = slack.calls.length;
	await run(t);
	await run(t);
	expect(channel.name).toBe("our-custom-name");
	expect(slack.calls.slice(callsBefore)).not.toContain("conversations.list");
	expect(slack.calls.slice(callsBefore)).not.toContain("conversations.create");
	expect(slack.calls).not.toContain("conversations.rename");
	channel.purpose.value = "Changed manually";
	await run(t);
	await run(t);
	expect(channel.purpose.value).toBe("Arrangementer med Testbedrift, høst 2026");
	expect(slack.calls.filter((call) => call === "conversations.setPurpose")).toHaveLength(2);
});

it("replaces legacy internal descriptions with Norwegian company and semester text once", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	const channel = slack.channels[0];
	if (!channel) throw new Error("Missing channel");
	channel.purpose.value = "Yggdrasil company semester rs71gh91zskmjstp2544yenkn98fd0hr";
	await run(t);
	await run(t);
	expect(channel.purpose.value).toBe("Arrangementer med Testbedrift, høst 2026");
	expect(slack.calls.filter((call) => call === "conversations.setPurpose")).toHaveLength(2);
	expect(channel.messages).toHaveLength(1);
});

describe("existing and new event alert parity", () => {
	it.each(["existing", "new"])(
		"recovers actionable notices for a %s event without relying on creation hooks",
		async (age) => {
			const { t, companyId } = await setup();
			const slack = fakeSlack();
			vi.setSystemTime(age === "existing" ? NOW - 60 * DAY_MS : NOW);
			const eventStart = NOW + 4 * DAY_MS;
			const eventId = await insertEvent(t, companyId, {
				eventStart,
				registrationOpens: NOW - 2 * DAY_MS,
				published: true,
				participationLimit: 1,
				remindersEnabled: true,
				title: "TBD",
				teaser: "TBD",
				description: "TBD",
			});
			vi.setSystemTime(NOW);
			const user = await insertUser(t, "parity@example.test");
			await insertRegistration(t, eventId, user._id, "registered");
			await t.run(async (ctx) => {
				await ctx.db.insert("eventReminderDeliveries", {
					eventId,
					eventStart,
					userId: user._id,
					kind: "week",
					emailId: "confirmed",
					sent: true,
				});
				await ctx.db.insert("eventReminderDeliveries", {
					eventId,
					eventStart,
					userId: user._id,
					kind: "twoDays",
					emailId: "queued-only",
					sent: false,
				});
				await ctx.db.insert("eventReminders", { eventId, kind: "twoDays", queuedAt: NOW });
				await ctx.db.insert("engagementAlerts", {
					eventId,
					rule: "unregisterWave",
					summary: "Fem avmeldinger",
					detail: "Sjekk påmeldingen",
					triggeredAt: NOW,
				});
			});
			await run(t);
			const texts = slack.channels[0]?.messages.map((m) => m.text).join("\n") ?? "";
			expect(texts).toContain("Dette gjør dere");
			expect(texts).toContain("?planning=prepare");
			expect(texts).toContain("tittel, teaser, beskrivelse");
			expect(texts).toContain("sjekklisten");
			expect(texts).toContain("Alle plassene er tatt");
			expect(texts).toContain("en påminnelse på e-post");
			expect(texts).not.toContain("påminnelsesmailen til dem som er påmeldt");
			expect(texts).toContain("Fem avmeldinger");
			const count = slack.channels[0]?.messages.length;
			await run(t, NOW + DAY_MS);
			expect(slack.channels[0]?.messages).toHaveLength(count as number);
		},
	);

	it.each(["existing", "new"])(
		"discovers unfinished report work and confirmed feedback rounds for a %s event",
		async (age) => {
			const { t, companyId } = await setup();
			const slack = fakeSlack();
			vi.setSystemTime(age === "existing" ? NOW - 60 * DAY_MS : NOW);
			const eventId = await insertEvent(t, companyId, {
				eventStart: NOW - 15 * DAY_MS,
				feedbackEnabled: true,
			});
			vi.setSystemTime(NOW);
			await t.run(async (ctx) => {
				const campaignId = await ctx.db.insert("feedbackCampaigns", {
					eventId,
					status: "closed",
					opensAt: NOW - 14 * DAY_MS,
					closesAt: NOW,
					generation: 1,
				});
				const inviteId = await ctx.db.insert("feedbackInvites", {
					campaignId,
					responded: false,
					bounced: false,
					complained: false,
					delivered: true,
					sent: true,
				});
				for await (const round of [0, 3, 7, 11])
					await ctx.db.insert("feedbackDeliveries", {
						campaignId,
						inviteId,
						round,
						emailId: `proof-${round}`,
						queuedAt: NOW,
						callbackAt: NOW,
						outcome: "delivered",
					});
				await ctx.db.insert("feedbackReports", {
					campaignId,
					eventId,
					eventTitle: "Report",
					eventStart: NOW - 15 * DAY_MS,
					companyName: "Test",
					recipientEmail: "company@example.test",
					status: "draft",
					questions: [],
					totalResponses: 1,
					buildCursor: null,
					revision: 1,
					retentionAt: NOW + 365 * DAY_MS,
					readyAt: NOW - 5 * DAY_MS,
				});
			});
			await run(t);
			const texts = slack.channels[0]?.messages.map((m) => m.text).join("\n") ?? "";
			expect(texts).toContain("Tilbakemeldingsrapporten er klar");
			expect(texts).toContain("venter fortsatt på gjennomgang");
			expect(texts).toContain("sende ut tilbakemeldingsskjemaet");
			for (const round of [1, 2, 3])
				expect(texts).toContain(`påminnelse ${round} om tilbakemeldingsskjemaet`);
			expect(texts).not.toContain("Dette gjør dere");
			const system = await t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect());
			expect(system).toHaveLength(1);
			expect(system[0]?.text).toContain("Åpne rapporten");
			// A missing system delivery is recovered even when the company notice was delivered.
			await t.run((ctx) => ctx.db.delete(system[0]?._id));
			await run(t);
			expect(await t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect())).toHaveLength(1);

			expect(slack.channels[0]?.archived).toBe(false);
			const count = slack.channels[0]?.messages.length;
			await run(t);
			expect(slack.channels[0]?.messages).toHaveLength(count as number);
			const report = await t.run((ctx) => ctx.db.query("feedbackReports").unique());
			if (!report) throw new Error("Missing report fixture");
			await t.run((ctx) =>
				ctx.db.patch(report._id, { status: "approved", deliveryStatus: "pending" }),
			);
			await run(t);
			expect(
				slack.channels[0]?.messages.some((message) =>
					message.text.includes("sendt tilbakemeldingsrapporten til bedriften"),
				),
			).toBe(false);
			await t.run((ctx) =>
				ctx.db.patch(report._id, { deliveryStatus: "delivered", followupFinishedAt: NOW }),
			);
			await run(t);
			expect(
				slack.channels[0]?.messages.filter((message) =>
					message.text.includes("sendt tilbakemeldingsrapporten til bedriften"),
				),
			).toHaveLength(1);
			await run(t, NOW + 7 * DAY_MS);
			expect(slack.channels[0]?.archived).toBe(true);
		},
	);

	it("keeps sending independent events and ignores legacy channel backoff when a welcome fails", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		vi.spyOn(console, "error").mockImplementation(() => {});
		const first = await insertEvent(t, companyId, { eventStart: START });
		const second = await insertEvent(t, companyId, { eventStart: START + DAY_MS, title: "Second" });
		slack.rejectText("Dette gjør dere");
		await run(t).catch(() => {});
		await t.run(async (ctx) => {
			const channel = await ctx.db.query("companySemesterSlackChannels").unique();
			if (!channel) throw new Error("No channel");
			await ctx.db.patch(channel._id, { retryAt: NOW + DAY_MS, failureCount: 10 });
			await queueEventNotification(ctx, first, "test-first", "First independent notice");
			await queueEventNotification(ctx, second, "test-second", "Second independent notice");
		});
		await run(t, NOW + 60_000).catch(() => {});
		expect(slack.channels[0]?.messages.map((m) => m.text).join("\n")).toContain(
			"First independent notice",
		);
		expect(slack.channels[0]?.messages.map((m) => m.text).join("\n")).toContain(
			"Second independent notice",
		);
		slack.rejectText();
		await run(t, NOW + 20 * 60_000);
		expect(
			slack.channels[0]?.messages.filter((m) => m.text.includes("Dette gjør dere")),
		).toHaveLength(1);
	});

	it("does not block notices when inviting a member fails", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		vi.spyOn(console, "error").mockImplementation(() => {});
		const eventId = await insertEvent(t, companyId, { eventStart: START });
		await organizer(t, eventId, "LEAD");
		slack.fail("conversations.invite");
		await run(t).catch(() => {});
		expect(slack.channels[0]?.messages).toHaveLength(1);
	});

	it("records notice intent while Slack is disabled and delivers once after reenabling", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, { eventStart: START });
		vi.stubEnv("SLACK_BOT_TOKEN", "");
		await t.run((ctx) => queueEventNotification(ctx, eventId, "persist-me", "Preserved notice"));
		expect(await t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(1);
		vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
		await run(t);
		await run(t);
		expect(
			slack.channels[0]?.messages.filter((m) => m.text.includes("Preserved notice")),
		).toHaveLength(1);
	});

	it("reactivates an unsent reminder after settings are restored without repeating successful delivery", async () => {
		const { t, companyId } = await setup();
		const slack = fakeSlack();
		const eventId = await insertEvent(t, companyId, { eventStart: START, remindersEnabled: false });
		await t.run((ctx) =>
			queueEventNotification(ctx, eventId, "reminder-sent:week", "Recovered reminder"),
		);
		await run(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(eventId, { remindersEnabled: true });
			await queueEventNotification(ctx, eventId, "reminder-sent:week", "Recovered reminder");
		});
		await run(t);
		await run(t);
		expect(
			slack.channels[0]?.messages.filter((m) => m.text.includes("Recovered reminder")),
		).toHaveLength(1);
	});
});

it("cancels queued legacy first-contact reminders after a date change", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	await t.run((ctx) =>
		queueEventNotification(ctx, eventId, `company-contact:${START}`, "Contact", {
			condition: "company-contact",
		}),
	);
	await t.run((ctx) => ctx.db.patch(eventId, { eventStart: START + DAY_MS }));
	await run(t);
	await t.run((ctx) => ctx.db.patch(eventId, { eventStart: START }));
	await run(t, eventPlanningAt(START, 28));
	expect(
		slack.channels[0]?.messages.filter(
			(message) =>
				message.text.includes(COMPANY_FIRST_CONTACT_TEMPLATE_URL) &&
				!message.text.includes("Dette gjør dere"),
		),
	).toHaveLength(0);
	await t.run((ctx) => ctx.db.patch(eventId, { eventStart: START + DAY_MS }));
	await run(t, eventPlanningAt(START + DAY_MS, 28));
	expect(
		slack.channels[0]?.messages.filter(
			(message) =>
				message.text.includes(COMPANY_FIRST_CONTACT_TEMPLATE_URL) &&
				!message.text.includes("Dette gjør dere"),
		),
	).toHaveLength(0);
});

it("does not let a missing report block the next notice", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	vi.spyOn(console, "error").mockImplementation(() => {});
	const eventId = await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	await t.run(async (ctx) => {
		await queueEventNotification(ctx, eventId, "report-ready:invalid", "Invalid source");
		await queueEventNotification(ctx, eventId, "z-independent", "Still delivered");
	});
	await run(t).catch(() => {});
	expect(
		slack.channels[0]?.messages.some((message) => message.text.includes("Still delivered")),
	).toBe(true);
});

it("does not create historical channels for events with no feedback campaign to follow up", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	await insertEvent(t, companyId, { eventStart: NOW - 180 * DAY_MS, feedbackEnabled: true });
	await run(t);
	expect(slack.channels).toHaveLength(0);
});

it("creates with the final name and stores its Slack ID without renaming", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	const stored = await t.run((ctx) => ctx.db.query("companySemesterSlackChannels").unique());
	expect(stored?.slackChannelId).toBe(slack.channels[0]?.id);
	expect(slack.channels[0]?.name).toBe("h26-testbedrift");
	expect(slack.calls).not.toContain("conversations.rename");
	expect(slack.calls).not.toContain("conversations.list");
});

it("creates a separate spring channel without renaming the autumn channel", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	const autumnId = slack.channels[0]?.id;
	const springStart = Date.parse("2027-02-15T15:15:00Z");
	await insertEvent(t, companyId, { eventStart: springStart });
	await run(t, eventPlanningAt(springStart, 35));
	expect(slack.channels).toHaveLength(2);
	expect(slack.channels[0]?.id).toBe(autumnId);
	expect(slack.channels[0]?.name).toBe("h26-testbedrift");
	expect(slack.channels[0]?.archived).toBe(true);
	expect(slack.channels[1]?.name).toBe("v27-testbedrift");
	expect(slack.channels[1]?.messages).toHaveLength(1);
	expect(slack.calls).not.toContain("conversations.rename");
});

it("repairs an old temporary channel name once without creating a new channel", async () => {
	const { t, companyId } = await setup();
	const slack = fakeSlack();
	await insertEvent(t, companyId, { eventStart: START });
	await run(t);
	const stored = await t.run((ctx) => ctx.db.query("companySemesterSlackChannels").unique());
	const channel = slack.channels[0];
	if (!stored || !channel) throw new Error("Missing channel");
	channel.name = `ygg-${stored._id}-1`;
	await run(t);
	await run(t);
	expect(slack.channels).toHaveLength(1);
	expect(channel.name).toBe("h26-testbedrift");
	expect(slack.calls.filter((call) => call === "conversations.rename")).toHaveLength(1);
});

it("finds the previous approved report for internal planning context", async () => {
	const { previousCompanyReport } = await import("../../companies/history");
	const { t, companyId } = await setup();
	const prior = await insertEvent(t, companyId, {
		eventStart: START - 100 * DAY_MS,
		slug: "prior",
	});
	const current = await insertEvent(t, companyId, { eventStart: START });
	const campaignId = await t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId: prior,
			status: "closed",
			generation: 1,
			opensAt: NOW - 90 * DAY_MS,
			closesAt: NOW - 75 * DAY_MS,
		}),
	);
	await t.run((ctx) =>
		ctx.db.insert("feedbackReports", {
			campaignId,
			eventId: prior,
			eventTitle: "Prior",
			eventStart: START - 100 * DAY_MS,
			companyName: "Bedrift",
			recipientEmail: "",
			status: "approved",
			questions: [],
			totalResponses: 1,
			buildCursor: null,
			revision: 1,
			retentionAt: START + 365 * DAY_MS,
			approvedAt: NOW - 70 * DAY_MS,
		}),
	);
	const reminders = await t.run(async (ctx) => {
		const event = await ctx.db.get(current);
		if (!event) throw new Error("Missing event");
		return previousCompanyReport(ctx, event, eventPlanningAt(START, 28));
	});
	expect(reminders).toContain("/events/prior/report");
});

it("scolds the lead organizer about missing attendance with Ey", async () => {
	const { eventMessage } = await import("./messages");
	const event = { _id: "event", title: "Bedpres", eventStart: START } as Doc<"events">;
	const lead = [{ name: "Lead", slackUserId: "LEAD" }] as Parameters<typeof eventMessage>[1];
	expect(eventMessage(event, lead, "Tekst", true, true)).toMatch(/^Ey! <@LEAD>\n/);
	expect(eventMessage(event, lead, "Tekst", true)).toMatch(/^Halla <@LEAD>!\n/);
});
