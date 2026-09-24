import type { SendEmailOptions } from "@convex-dev/resend";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";
import { feedbackConfig } from "../constants";
import { feedbackResend } from "../delivery/messages";

const huginBaseUrl = feedbackConfig.huginBaseUrl;

async function fixture(email: string, role?: "internal") {
	const { t, companyId } = await setup();
	const user = await insertUser(t, email);
	if (role) await grantRole(t, user._id, role);
	const eventId = await insertEvent(t, companyId, {
		title: "Bedpres med Testbedrift",
		eventStart: Date.UTC(2025, 2, 14, 16),
	});
	return { t, eventId, client: asUser(t, user) };
}

describe("feedback test send", () => {
	beforeEach(() => {
		vi.stubEnv("APP_ENV", "test");
		feedbackConfig.huginBaseUrl = "https://hugin.example.test";
		feedbackResend.config.apiKey = "re_test";
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
		feedbackConfig.huginBaseUrl = huginBaseUrl;
	});

	it("sends the invitation, a reminder and the report email for a past event to the caller", async () => {
		const f = await fixture("Admin@IFINAVET.no", "internal");
		const sendEmail = vi.spyOn(feedbackResend, "sendEmail");

		expect(await f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId })).toBe(3);

		const sent = sendEmail.mock.calls.map(
			(call) => (call as unknown as [unknown, SendEmailOptions])[1],
		);
		expect(sent.map(({ to, subject }) => ({ to, subject }))).toEqual([
			{ to: "Admin@IFINAVET.no", subject: "Tilbakemelding: Bedpres med Testbedrift" },
			{ to: "Admin@IFINAVET.no", subject: "Påminnelse: Bedpres med Testbedrift" },
			{ to: "Admin@IFINAVET.no", subject: "Rapport fra Bedpres med Testbedrift" },
		]);
		for (const email of sent) {
			expect(email).toMatchObject({
				from: "Navet <info@ifinavet.no>",
				replyTo: ["arrangement@ifinavet.no"],
			});
		}
		expect(sent[0]?.html).toContain("https://hugin.example.test/feedback#token=");
		expect(sent[2]?.html).toContain("https://hugin.example.test/report#token=");
		expect(sent[2]?.html).toContain("14. mars");
	});

	it("stores no links, deliveries or reports", async () => {
		const f = await fixture("admin@ifinavet.no", "internal");
		await f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId });

		const stored = await f.t.run(async (ctx) => ({
			tokens: await ctx.db.query("feedbackTokens").collect(),
			deliveries: await ctx.db.query("feedbackDeliveries").collect(),
			reports: await ctx.db.query("feedbackReports").collect(),
		}));
		expect(stored).toEqual({ tokens: [], deliveries: [], reports: [] });
	});

	it("refuses callers without an internal role", async () => {
		const f = await fixture("admin@ifinavet.no");
		const sendEmail = vi.spyOn(feedbackResend, "sendEmail");

		expect(
			await refusalMessageFrom(
				f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId }),
			),
		).toContain("Unauthorized");
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("refuses internal users outside the ifinavet.no domain", async () => {
		const f = await fixture("admin@ifinavet.no.example.test", "internal");
		const sendEmail = vi.spyOn(feedbackResend, "sendEmail");

		expect(
			await refusalMessageFrom(
				f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId }),
			),
		).toBe("Testutsending krever en @ifinavet.no-adresse.");
		expect(sendEmail).not.toHaveBeenCalled();
	});
});
