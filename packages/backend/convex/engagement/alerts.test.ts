import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "@workspace/shared/time";
import { describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertOrganizer,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { describeAlert, slackText } from "./alerts";

const OPENS = Date.UTC(2026, 8, 1, 10);
const START = OPENS + 10 * DAY_MS;

const eventFields: Doc<"events"> = {
	_id: "event" as Id<"events">,
	_creationTime: 0,
	title: "Kodekveld",
	teaser: "",
	description: "",
	eventStart: START,
	registrationOpens: OPENS,
	participationLimit: 10,
	location: "Ole-Johan Dahls hus",
	language: "norsk",
	ageRestriction: "",
	externalEvent: false,
	externalUrl: "",
	hostingCompany: "company" as Id<"companies">,
	published: true,
};

type Snapshot = Parameters<typeof describeAlert>[3];

function snapshotBase(): Snapshot {
	return {
		registered: 4,
		waitlist: 0,
		demandFill: 0.4,
		registrationTimes: [],
		unregistrations: [],
		delta24h: 0,
		progress: 0.5,
		baseline: null,
		expectedFillNow: null,
		projectedFill: 0.4,
		status: { kind: "onPace" },
	};
}

function unregisteredAt(at: number) {
	return { change: "unregistered" as const, fromStatus: "registered" as const, at };
}

async function alertsFor(t: TestBackend, eventId: Id<"events">) {
	return t.run((ctx) =>
		ctx.db
			.query("engagementAlerts")
			.withIndex("by_eventId_and_rule", (q) => q.eq("eventId", eventId))
			.collect(),
	);
}

describe("describeAlert", () => {
	it("describes an unregister wave with the span between the first and last unregistration", () => {
		const snapshot = {
			...snapshotBase(),
			unregistrations: [
				unregisteredAt(OPENS + 10 * MINUTE_MS),
				unregisteredAt(OPENS + 40 * MINUTE_MS),
			],
		};
		const result = describeAlert("unregisterWave", eventFields, "Bedrift AS", snapshot, OPENS);
		expect(result.summary).toBe("2 avmeldinger på 30 min på Kodekveld, Bedrift AS");
		expect(result.detail).toBe("4 av 10 plasser er fortsatt tatt.");
	});

	it("rounds a near-instant wave up to at least one minute", () => {
		const snapshot = {
			...snapshotBase(),
			unregistrations: [unregisteredAt(OPENS), unregisteredAt(OPENS + 1)],
		};
		const result = describeAlert("unregisterWave", eventFields, "Bedrift AS", snapshot, OPENS);
		expect(result.summary).toContain("på 1 min");
	});

	it("describes a behind pace alert with a baseline comparison", () => {
		const snapshot = { ...snapshotBase(), expectedFillNow: 0.75 };
		const now = START - 2 * DAY_MS;
		const result = describeAlert("behindPace", eventFields, "Bedrift AS", snapshot, now);
		expect(result.summary).toBe("Kodekveld, Bedrift AS ligger an til 40 % fylt");
		expect(result.detail).toBe(
			"4 av 10 plasser, 2 dager igjen. Forventet på dette tidspunktet er 75 % fylt.",
		);
	});

	it("describes a behind pace alert without a baseline comparison", () => {
		const snapshot = snapshotBase();
		const now = START - DAY_MS + HOUR_MS;
		const result = describeAlert("behindPace", eventFields, "Bedrift AS", snapshot, now);
		expect(result.detail).toBe("4 av 10 plasser, 1 dag igjen.");
	});

	it("describes no registrations with the formatted opening date", () => {
		const snapshot = snapshotBase();
		const result = describeAlert("noRegistrations", eventFields, "Bedrift AS", snapshot, OPENS);
		expect(result.summary).toBe("Ingen påmeldinger på Kodekveld, Bedrift AS");
		expect(result.detail).toBe("Påmeldingen åpnet 1. sep.");
	});
});

describe("slackText", () => {
	it("explains the alert and links to the event and the insight page", () => {
		const text = slackText(
			"noRegistrations",
			"event123" as Id<"events">,
			{ summary: "Ingen påmeldinger på Kodekveld, Acme", detail: "Påmeldingen åpnet 1. sep." },
			[{ name: "Kari Nordmann", slackUserId: "U123" }, { name: "Ola <Nordmann>" }],
			"https://bifrost.test",
		);

		expect(text.split("\n")).toEqual([
			"🦗 Ingen har meldt seg på ennå",
			"Ingen påmeldinger på Kodekveld, Acme. Påmeldingen åpnet 1. sep.",
			"🙋 Hovedansvarlig: <@U123>, Ola &lt;Nordmann&gt;",
			"💡 Sjekk at arrangementet er publisert og har blitt delt i kanalene våre.",
			"👉 <https://bifrost.test/events/event123|Åpne arrangementet> · <https://bifrost.test/insight|Se innsikt>",
		]);
	});

	it("names the main organizer without tagging when the alert only informs", () => {
		for (const rule of ["behindPace", "unregisterWave"] as const) {
			const text = slackText(
				rule,
				"event123" as Id<"events">,
				{ summary: "Kodekveld, Acme", detail: "4 av 10 plasser." },
				[{ name: "Kari Nordmann", slackUserId: "U123" }],
				"https://bifrost.test",
			);

			expect(text).toContain("🙋 Hovedansvarlig: Kari Nordmann\n");
			expect(text).not.toContain("<@");
		}
	});

	it("escapes Slack control characters in event names", () => {
		const text = slackText(
			"behindPace",
			"event123" as Id<"events">,
			{ summary: "Fest <3 & mat", detail: "4 av 10 plasser." },
			[],
			"https://bifrost.test",
		);

		expect(text).toContain("Fest &lt;3 &amp; mat. 4 av 10 plasser.");
		expect(text).not.toContain("Hovedansvarlig");
	});
});

describe("detectAlerts", () => {
	it("inserts an alert and schedules a Slack notification when a rule triggers", async () => {
		const { t, companyId } = await setup();
		vi.useFakeTimers();
		vi.setSystemTime(OPENS + DAY_MS);
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
		});

		const triggered = await t.mutation(internal.engagement.alerts.detectAlerts, {});
		expect(triggered).toBe(1);

		const alerts = await alertsFor(t, eventId);
		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.rule).toBe("noRegistrations");
		expect(alerts[0]?.dismissedAt).toBeUndefined();

		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		expect(scheduled).toHaveLength(1);
		expect(scheduled[0]?.name).toContain("notifications:sendMessage");
		expect(scheduled[0]?.args[0]).toMatchObject({ channel: SYSTEM_ALERTS_CHANNEL });
		expect(scheduled[0]?.args[0].text).toContain(`https://bifrost.ifinavet.no/events/${eventId}`);

		vi.useRealTimers();
	});

	it("tags only the linked main organizer and names the unlinked one", async () => {
		const { t, companyId } = await setup();
		vi.useFakeTimers();
		vi.setSystemTime(OPENS + DAY_MS);
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
		});
		const linked = await insertUser(t, "kari@ifinavet.no", {
			firstName: "Kari",
			lastName: "Nordmann",
		});
		const unlinked = await insertUser(t, "ola@ifinavet.no", {
			firstName: "Ola",
			lastName: "Hansen",
		});
		const helper = await insertUser(t, "per@ifinavet.no", { firstName: "Per", lastName: "Helper" });
		const removed = await insertUser(t, "borte@ifinavet.no");
		await insertOrganizer(t, eventId, linked._id);
		await insertOrganizer(t, eventId, unlinked._id);
		await insertOrganizer(t, eventId, helper._id, "medhjelper");
		await insertOrganizer(t, eventId, removed._id);
		await t.run(async (ctx) => {
			await ctx.db.delete(removed._id);
			for (const [userId, slackUserId] of [
				[linked._id, "UKARI"],
				[helper._id, "UPER"],
			] as const) {
				await ctx.db.insert("memberAccounts", {
					workspaceEmail: `${slackUserId}@ifinavet.no`,
					firstName: "",
					lastName: "",
					group: "styret",
					stage: "active",
					google: "created",
					slackUserId,
					userId,
					updatedAt: 0,
				});
			}
		});

		await t.mutation(internal.engagement.alerts.detectAlerts, {});

		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		const text: string = scheduled[0]?.args[0].text;
		expect(text).toContain("🙋 Hovedansvarlig: <@UKARI>, Ola Hansen\n");
		expect(text).not.toContain("UPER");

		vi.useRealTimers();
	});

	it("links to the local admin app during local development", async () => {
		const { t, companyId } = await setup();
		vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
		vi.stubEnv("APP_ENV", "local");
		vi.useFakeTimers();
		vi.setSystemTime(OPENS + DAY_MS);
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
		});

		await t.mutation(internal.engagement.alerts.detectAlerts, {});

		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		expect(scheduled[0]?.args[0].text).toContain(`http://localhost:3001/events/${eventId}`);

		vi.useRealTimers();
		vi.unstubAllEnvs();
	});

	it("skips events without a triggering rule", async () => {
		const { t, companyId } = await setup();
		vi.useFakeTimers();
		vi.setSystemTime(OPENS + HOUR_MS);
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
		});

		const triggered = await t.mutation(internal.engagement.alerts.detectAlerts, {});
		expect(triggered).toBe(0);
		expect(await alertsFor(t, eventId)).toHaveLength(0);

		vi.useRealTimers();
	});

	it("does not duplicate an alert triggered within the dedup window", async () => {
		const { t, companyId } = await setup();
		vi.useFakeTimers();
		vi.setSystemTime(OPENS + DAY_MS);
		await insertEvent(t, companyId, { eventStart: START, registrationOpens: OPENS });

		await t.mutation(internal.engagement.alerts.detectAlerts, {});
		vi.setSystemTime(OPENS + DAY_MS + HOUR_MS);
		const triggered = await t.mutation(internal.engagement.alerts.detectAlerts, {});

		expect(triggered).toBe(0);

		vi.useRealTimers();
	});

	it("triggers again once the dedup window has passed", async () => {
		const { t, companyId } = await setup();
		vi.useFakeTimers();
		vi.setSystemTime(OPENS + DAY_MS);
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
		});

		await t.mutation(internal.engagement.alerts.detectAlerts, {});
		vi.setSystemTime(OPENS + 2 * DAY_MS + HOUR_MS);
		const triggered = await t.mutation(internal.engagement.alerts.detectAlerts, {});

		expect(triggered).toBe(1);
		expect(await alertsFor(t, eventId)).toHaveLength(2);

		vi.useRealTimers();
	});
});

describe("dismissAlert", () => {
	it("refuses callers without an internal role", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const alertId = await t.run((ctx) =>
			ctx.db.insert("engagementAlerts", {
				eventId,
				rule: "noRegistrations",
				summary: "s",
				detail: "d",
				triggeredAt: Date.now(),
			}),
		);
		const stranger = await insertUser(t, "utenrolle@example.com");

		await expect(
			refusalMessageFrom(
				asUser(t, stranger).mutation(api.engagement.alerts.dismissAlert, { alertId }),
			),
		).resolves.toContain("Unauthorized");
	});

	it("marks the alert as dismissed for a caller with an internal role", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const alertId = await t.run((ctx) =>
			ctx.db.insert("engagementAlerts", {
				eventId,
				rule: "noRegistrations",
				summary: "s",
				detail: "d",
				triggeredAt: Date.now(),
			}),
		);
		const staff = await insertUser(t, "internal@example.com");
		await grantRole(t, staff._id, "internal");

		await asUser(t, staff).mutation(api.engagement.alerts.dismissAlert, { alertId });

		const alert = await t.run((ctx) => ctx.db.get(alertId));
		expect(alert?.dismissedAt).toBeTypeOf("number");
	});
});
