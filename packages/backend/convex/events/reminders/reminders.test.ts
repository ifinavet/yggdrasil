import { render } from "@react-email/render";
import { NAVET_LOGO_URL } from "@workspace/emails/constants";
import EventReminderEmail from "@workspace/emails/event-reminder-email";
import { REMINDER_INFO_MAX_LENGTH } from "@workspace/shared/events/reminder";
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
import { feedbackResend as resend } from "../../feedback/delivery/messages";

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

async function internalClient(t: TestBackend, email = "internal@example.test") {
	const user = await insertUser(t, email);
	await grantRole(t, user._id, "internal");
	return { user, client: asUser(t, user) };
}

async function systemAlerts(t: TestBackend) {
	return t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect());
}

describe("approveEventReminder", () => {
	it("saves the info and queues the reminder once", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() + 2 * DAY_IN_MS });
		const { user, client } = await internalClient(t);
		const { approveEventReminder } = api.events.reminders.mutations;

		await client.mutation(approveEventReminder, { eventId, text: "  Ta med PC.  " });
		const message = await refusalMessageFrom(
			client.mutation(approveEventReminder, { eventId, text: "" }),
		);

		expect(message).toContain("allerede sendt");
		expect(await queuedReminders(t)).toEqual([{ eventId, kind: "twoDays" }]);
		expect(await client.query(api.events.reminders.queries.getEventReminders, { eventId })).toEqual(
			{
				enabled: true,
				info: "Ta med PC.",
				sentAt: expect.any(Number),
				sentBy: "Test Testesen",
			},
		);
		const rows = await t.run((ctx) => ctx.db.query("eventReminders").collect());
		expect(rows).toEqual([expect.objectContaining({ approvedBy: user._id })]);
	});

	it("refuses users without an internal role", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() + 2 * DAY_IN_MS });
		const student = asUser(t, await insertUser(t, "student@example.test"));
		const message = await refusalMessageFrom(
			student.mutation(api.events.reminders.mutations.approveEventReminder, {
				eventId,
				text: "",
			}),
		);
		expect(message).toContain("Du har ikke tilgang");
		expect(await queuedReminders(t)).toEqual([]);
	});

	it("refuses events that are off, hidden, external or started", async () => {
		const { t, companyId } = await setup();
		const { client } = await internalClient(t);
		const soon = Date.now() + DAY_IN_MS;
		const events = await Promise.all([
			insertEvent(t, companyId, { eventStart: soon }),
			insertEvent(t, companyId, { eventStart: soon, remindersEnabled: true, published: false }),
			insertEvent(t, companyId, { eventStart: soon, remindersEnabled: true, externalEvent: true }),
			insertEvent(t, companyId, { eventStart: Date.now() - HOUR_IN_MS, remindersEnabled: true }),
		]);
		for (const eventId of events)
			await expect(
				client.mutation(api.events.reminders.mutations.approveEventReminder, { eventId, text: "" }),
			).rejects.toThrow();
		expect(await queuedReminders(t)).toEqual([]);
	});

	it("rejects info over the length limit", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() + DAY_IN_MS });
		const { client } = await internalClient(t);
		await expect(
			client.mutation(api.events.reminders.mutations.saveReminderInfo, {
				eventId,
				text: "a".repeat(REMINDER_INFO_MAX_LENGTH + 1),
			}),
		).rejects.toThrow();
	});
});

describe("alertMissingReminders", () => {
	it("alerts once for a started event nobody approved", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() - HOUR_IN_MS });
		await t.mutation(internal.events.reminders.mutations.alertMissingReminders, {});
		await t.mutation(internal.events.reminders.mutations.alertMissingReminders, {});
		const alerts = await systemAlerts(t);
		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.clientMsgId).toContain(eventId);
		expect(alerts[0]?.text).toContain("🚨 *Ingen påminnelsesmail ble sendt*");
		expect(alerts[0]?.text).toContain("godkjente aldri påminnelsesmailen i Bifrost");
	});

	it("stays quiet for approved, upcoming, old and switched off events", async () => {
		const { t, companyId, eventId } = await setupEvent({ eventStart: Date.now() - HOUR_IN_MS });
		await t.run((ctx) =>
			ctx.db.insert("eventReminders", { eventId, kind: "twoDays", queuedAt: Date.now() }),
		);
		await insertEvent(t, companyId, {
			eventStart: Date.now() + HOUR_IN_MS,
			remindersEnabled: true,
		});
		await insertEvent(t, companyId, {
			eventStart: Date.now() - 2 * DAY_IN_MS,
			remindersEnabled: true,
		});
		await insertEvent(t, companyId, { eventStart: Date.now() - HOUR_IN_MS });
		await insertEvent(t, companyId, {
			eventStart: Date.now() - HOUR_IN_MS,
			remindersEnabled: true,
			externalEvent: true,
		});
		await t.mutation(internal.events.reminders.mutations.alertMissingReminders, {});
		expect(await systemAlerts(t)).toEqual([]);
	});
});

describe("getOwnReminderInfo", () => {
	it("shows the info only to registered students", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() + DAY_IN_MS });
		const { client } = await internalClient(t);
		await client.mutation(api.events.reminders.mutations.saveReminderInfo, {
			eventId,
			text: "Last ned Docker.",
		});
		const registered = await insertUser(t, "registered@example.test");
		const waitlisted = await insertUser(t, "waitlist@example.test");
		await insertRegistration(t, eventId, registered._id, "registered");
		await insertRegistration(t, eventId, waitlisted._id, "waitlist");
		const { getOwnReminderInfo } = api.events.reminders.queries;
		const args = { eventIdentifier: eventId };

		expect(await asUser(t, registered).query(getOwnReminderInfo, args)).toBe("Last ned Docker.");
		expect(await asUser(t, waitlisted).query(getOwnReminderInfo, args)).toBeNull();
		expect(await t.query(getOwnReminderInfo, args)).toBeNull();
	});
});

describe("previewEventReminder", () => {
	it("renders the draft info for internals only", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() + DAY_IN_MS });
		const { client } = await internalClient(t);
		const preview = await client.action(api.events.reminders.emails.previewEventReminder, {
			eventId,
			info: "Ta med PC.",
		});
		expect(preview?.subject).toContain("Bedriftspresentasjon med Testbedrift");
		expect(preview?.html).toContain("Ta med PC.");
		const student = asUser(t, await insertUser(t, "student@example.test"));
		await expect(
			student.action(api.events.reminders.emails.previewEventReminder, { eventId, info: "" }),
		).rejects.toThrow();
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
	it("does not send once the event has started", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() - HOUR_IN_MS });
		const user = await insertUser(t, "started@example.test");
		await insertRegistration(t, eventId, user._id, "registered");
		const sendEmail = vi.spyOn(resend, "sendEmail");
		await t.action(internal.events.reminders.emails.sendEventReminder, {
			eventId,
			kind: "twoDays",
		});
		expect(sendEmail).not.toHaveBeenCalled();
		vi.restoreAllMocks();
	});

	it("keeps sending to the rest when one recipient fails", async () => {
		const { t, eventId } = await setupEvent({ eventStart: Date.now() + 5 * DAY_IN_MS });
		const first = await insertUser(t, "first@example.test");
		const second = await insertUser(t, "second@example.test");
		await insertRegistration(t, eventId, first._id, "registered");
		await insertRegistration(t, eventId, second._id, "registered");
		const sendEmail = vi
			.spyOn(resend, "sendEmail")
			.mockRejectedValueOnce(new Error("invalid recipient"))
			.mockResolvedValue("email-id" as never);
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		await t.action(internal.events.reminders.emails.sendEventReminder, {
			eventId,
			kind: "twoDays",
		});

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
		const { client } = await internalClient(t);
		const { getEventReminders } = api.events.reminders.queries;
		expect(await client.query(getEventReminders, { eventId })).toMatchObject({ enabled: false });
		await client.mutation(api.events.reminders.mutations.setEventReminders, {
			eventId,
			enabled: true,
		});
		expect(await client.query(getEventReminders, { eventId })).toMatchObject({ enabled: true });
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
				eventUrl: "https://ifinavet.no/events/testbedrift",
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
		expect(text).toContain("Du finner mer informasjon på arrangementssiden");
		expect(text).toContain("https://ifinavet.no/events/testbedrift");
	});

	it("includes the info from the company", async () => {
		const text = await render(
			EventReminderEmail({
				company: "Testbedrift",
				time: "torsdag 1. oktober, 16:15",
				location: "Escape",
				info: "Ta med PC.\nLast ned Docker på forhånd.",
				eventUrl: "https://ifinavet.no/events/testbedrift",
				signature: { name: "Kari Nordmann", email: "kari@ifinavet.no" },
			}),
			{ plainText: true },
		);
		expect(text).toContain("Ta med PC.");
		expect(text).toContain("Last ned Docker på forhånd.");
		expect(text).toContain("Du finner også denne informasjonen på arrangementssiden");
	});

	it("signs off with the organizer and the Navet logo", async () => {
		const html = await render(
			EventReminderEmail({
				company: "Testbedrift",
				time: "torsdag 1. oktober, 16:15",
				location: "Escape",
				eventUrl: "https://ifinavet.no/events/testbedrift",
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
