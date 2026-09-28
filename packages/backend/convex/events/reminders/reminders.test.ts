import { render } from "@react-email/render";
import { NAVET_LOGO_URL } from "@workspace/emails/constants";
import EventReminderEmail from "@workspace/emails/event-reminder-email";
import { describe, expect, it, vi } from "vitest";
import {
	asUser,
	DAY_IN_MS,
	type EventOverrides,
	grantRole,
	HOUR_IN_MS,
	insertEvent,
	insertInternal,
	insertOrganizer,
	insertRegistration,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { resend } from "../../emails";
import { dueReminder } from "./schedule";

const now = Date.UTC(2026, 9, 1, 12);

async function setupEvent(overrides: EventOverrides = {}) {
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId, { remindersEnabled: true, ...overrides });
	return { t, companyId, eventId };
}

async function queuedReminders(t: TestBackend) {
	return t.run(async (ctx) => {
		const jobs = await ctx.db.system.query("_scheduled_functions").collect();
		return jobs
			.filter((job) => job.name.endsWith("sendEventReminder"))
			.map((job) => job.args[0] as { eventId: Id<"events">; kind: string });
	});
}

describe("dueReminder", () => {
	it("picks the reminder whose window the event is in", () => {
		expect(dueReminder(now + 8 * DAY_IN_MS, now)).toBeNull();
		expect(dueReminder(now + 7 * DAY_IN_MS, now)).toBe("week");
		expect(dueReminder(now + 3 * DAY_IN_MS, now)).toBe("week");
		expect(dueReminder(now + 2 * DAY_IN_MS, now)).toBe("twoDays");
		expect(dueReminder(now + HOUR_IN_MS, now)).toBe("twoDays");
		expect(dueReminder(now, now)).toBeNull();
		expect(dueReminder(now - HOUR_IN_MS, now)).toBeNull();
	});
});

describe("queueDueReminders", () => {
	it("queues each reminder once per enabled event", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() + 5 * DAY_IN_MS });
		await t.mutation(internal.events.reminders.mutations.queueDueReminders, {});
		await t.mutation(internal.events.reminders.mutations.queueDueReminders, {});
		expect(await queuedReminders(t)).toEqual([{ eventId, kind: "week" }]);
	});

	it("queues the two day reminder even after the week reminder", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() + DAY_IN_MS });
		await t.run((ctx) =>
			ctx.db.insert("eventReminders", { eventId, kind: "week", queuedAt: Date.now() }),
		);
		await t.mutation(internal.events.reminders.mutations.queueDueReminders, {});
		expect(await queuedReminders(t)).toEqual([{ eventId, kind: "twoDays" }]);
	});

	it("skips events that are off, hidden, external or outside the window", async () => {
		const { t, companyId } = await setupEvent({ eventStart: Date.now() + 8 * DAY_IN_MS });
		const soon = Date.now() + DAY_IN_MS;
		await insertEvent(t, companyId, { eventStart: soon });
		await insertEvent(t, companyId, { eventStart: soon, remindersEnabled: false });
		await insertEvent(t, companyId, { eventStart: soon, remindersEnabled: true, published: false });
		await insertEvent(t, companyId, {
			eventStart: soon,
			remindersEnabled: true,
			externalEvent: true,
		});
		await insertEvent(t, companyId, {
			eventStart: Date.now() - HOUR_IN_MS,
			remindersEnabled: true,
		});
		await t.mutation(internal.events.reminders.mutations.queueDueReminders, {});
		expect(await queuedReminders(t)).toEqual([]);
	});
});

describe("emailContext", () => {
	it("sends to registered students and signs as the lead organizer", async () => {
		const { t, eventId } = await setupEvent({ location: "Escape" });
		const registered = await insertUser(t, "registered@example.test");
		const waitlisted = await insertUser(t, "waitlist@example.test");
		const deleted = await insertUser(t, "deleted@example.test", { deleted: true });
		await insertRegistration(t, eventId, registered._id, "registered");
		await insertRegistration(t, eventId, waitlisted._id, "waitlist");
		await insertRegistration(t, eventId, deleted._id, "registered");
		const lead = await insertUser(t, "lead@example.test", {
			firstName: "Kari",
			lastName: "Nordmann",
		});
		await insertInternal(t, lead._id, "Bedriftskontakt", {
			positionEmail: "bedrift@ifinavet.no",
		});
		await insertOrganizer(t, eventId, lead._id);

		const context = await t.query(internal.events.reminders.queries.emailContext, { eventId });

		expect(context).toMatchObject({
			company: "Testbedrift",
			location: "Escape",
			signature: {
				name: "Kari Nordmann",
				position: "Bedriftskontakt",
				email: "bedrift@ifinavet.no",
			},
			recipients: [{ userId: registered._id, email: "registered@example.test" }],
		});
	});

	it("falls back to Navet without a lead organizer", async () => {
		const { t, eventId } = await setupEvent();
		const context = await t.query(internal.events.reminders.queries.emailContext, { eventId });
		expect(context?.signature).toEqual({ name: "Navet", email: "arrangement@ifinavet.no" });
	});

	it("returns nothing once reminders are turned off", async () => {
		const { t, eventId } = await setupEvent({ remindersEnabled: false });
		expect(await t.query(internal.events.reminders.queries.emailContext, { eventId })).toBeNull();
	});
});

describe("sendEventReminder", () => {
	it("keeps sending to the rest when one recipient fails", async () => {
		const { t, eventId } = await setupEvent();
		const first = await insertUser(t, "first@example.test");
		const second = await insertUser(t, "second@example.test");
		await insertRegistration(t, eventId, first._id, "registered");
		await insertRegistration(t, eventId, second._id, "registered");
		const sendEmail = vi
			.spyOn(resend, "sendEmail")
			.mockRejectedValueOnce(new Error("invalid recipient"))
			.mockResolvedValue("email-id" as never);
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		await t.action(internal.events.reminders.emails.sendEventReminder, { eventId, kind: "week" });

		expect(sendEmail).toHaveBeenCalledTimes(2);
		expect(sendEmail).toHaveBeenLastCalledWith(
			expect.anything(),
			expect.objectContaining({ to: "second@example.test" }),
		);
		vi.restoreAllMocks();
	});
});

describe("setEventReminders", () => {
	it("lets internals toggle reminders", async () => {
		const { t, eventId } = await setupEvent({ remindersEnabled: undefined });
		const user = await insertUser(t, "internal@example.test");
		await grantRole(t, user._id, "internal");
		const client = asUser(t, user);
		const { getEventReminders } = api.events.reminders.queries;
		expect(await client.query(getEventReminders, { eventId })).toEqual({ enabled: false });
		await client.mutation(api.events.reminders.mutations.setEventReminders, {
			eventId,
			enabled: true,
		});
		expect(await client.query(getEventReminders, { eventId })).toEqual({ enabled: true });
	});

	it("refuses users without an internal role", async () => {
		const { t, eventId } = await setupEvent({ remindersEnabled: undefined });
		const student = asUser(t, await insertUser(t, "student@example.test"));
		const message = await refusalMessageFrom(
			student.mutation(api.events.reminders.mutations.setEventReminders, {
				eventId,
				enabled: true,
			}),
		);
		expect(message).toContain("Du har ikke tilgang");
		expect(await t.run((ctx) => ctx.db.get(eventId))).not.toHaveProperty("remindersEnabled");
	});
});

describe("EventReminderEmail", () => {
	it("fills in the event and signature", async () => {
		const text = await render(
			EventReminderEmail({
				company: "Testbedrift",
				time: "torsdag 1. oktober, 16:15",
				location: "Escape",
				signature: {
					name: "Kari Nordmann",
					position: "Bedriftskontakt",
					email: "kari@ifinavet.no",
				},
			}),
			{ plainText: true },
		);
		expect(text).toContain(
			"bedriftspresentasjon med Testbedrift torsdag 1. oktober, 16:15 Escape.",
		);
		expect(text).toContain("Bedriftskontakt | Navet");
		expect(text).toContain("https://ifinavet.no/info/retningslinjer");
		expect(text).not.toContain("+47");
	});

	it("signs off with the organizer and the Navet logo", async () => {
		const html = await render(
			EventReminderEmail({
				company: "Testbedrift",
				time: "torsdag 1. oktober, 16:15",
				location: "Escape",
				signature: { name: "Kari Nordmann", email: "kari@ifinavet.no" },
			}),
		);
		const signature = html.slice(html.indexOf("Med vennlig hilsen,"));
		expect(signature).toContain("Kari Nordmann");
		expect(signature).toContain('href="mailto:kari@ifinavet.no"');
		expect(signature).toContain(`src="${NAVET_LOGO_URL}"`);
		expect(signature).not.toContain(" | Navet");
	});
});
