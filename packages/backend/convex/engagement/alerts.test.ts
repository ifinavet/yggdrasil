import { DAY_MS, HOUR_MS, MINUTE_MS } from "@workspace/shared/time";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { describeAlert } from "./alerts";

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
	food: "",
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
			"4 av 10 plasser, 2 dager igjen. Lignende arrangementer var 75 % fylt på samme tidspunkt.",
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
		expect(scheduled[0]?.name).toContain("notifySlack");

		vi.useRealTimers();
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

describe("notifySlack", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("returns false and never calls fetch when the webhook url is missing", async () => {
		const { t } = await setup();
		vi.stubEnv("SLACK_ENGAGEMENT_WEBHOOK_URL", "");
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const result = await t.action(internal.engagement.alerts.notifySlack, { text: "hei" });

		expect(result).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("posts the text to the webhook url and returns true on success", async () => {
		const { t } = await setup();
		vi.stubEnv("SLACK_ENGAGEMENT_WEBHOOK_URL", "https://hooks.slack.test/webhook");
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fetchMock);

		const result = await t.action(internal.engagement.alerts.notifySlack, { text: "hei alle" });

		expect(result).toBe(true);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://hooks.slack.test/webhook",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: "hei alle" }),
			}),
		);
	});

	it("throws when Slack responds with a non-ok status", async () => {
		const { t } = await setup();
		vi.stubEnv("SLACK_ENGAGEMENT_WEBHOOK_URL", "https://hooks.slack.test/webhook");
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

		await expect(t.action(internal.engagement.alerts.notifySlack, { text: "hei" })).rejects.toThrow(
			"Slack svarte 500",
		);
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
