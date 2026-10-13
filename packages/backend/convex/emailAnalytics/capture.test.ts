import { Webhook } from "svix";
import { afterEach, describe, expect, it, vi } from "vitest";
import { insertUser, setup } from "../../test/fixtures";
import { internal } from "../_generated/api";
import { feedbackResend } from "../feedback/delivery/messages";
import { sha256 } from "../lib/tokens";
import { capturedEmailEvent } from "./capture";

const CREATED_AT = "2026-10-13T10:00:00.000Z";

function resendPayload(type: string, to: unknown = ["Student@Example.com"]) {
	return {
		type,
		created_at: CREATED_AT,
		data: {
			email_id: "re_123",
			created_at: CREATED_AT,
			from: "info@ifinavet.no",
			to,
			subject: "Hei",
			open: { ipAddress: "127.0.0.1", timestamp: CREATED_AT, userAgent: "Mail" },
		},
	};
}

function stubPostHog() {
	const fetch = vi.fn(
		async (_url: string, _init: RequestInit) => new Response(null, { status: 200 }),
	);
	vi.stubGlobal("fetch", fetch);
	vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
	return () => fetch.mock.calls.map(([, init]) => JSON.parse(String(init.body)));
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("capturedEmailEvent", () => {
	it("keeps delivered and opened events", () => {
		expect(capturedEmailEvent(resendPayload("email.opened"))).toEqual({
			type: "email.opened",
			emailId: "re_123",
			recipient: "Student@Example.com",
			createdAt: CREATED_AT,
		});
		expect(capturedEmailEvent(resendPayload("email.delivered", "a@b.no"))?.recipient).toBe(
			"a@b.no",
		);
	});

	it.each([
		["other event types", resendPayload("email.sent")],
		["inherited keys", resendPayload("toString")],
		["a missing recipient", resendPayload("email.opened", [])],
		["a missing timestamp", { ...resendPayload("email.opened"), created_at: undefined }],
		["missing data", { type: "email.opened", created_at: CREATED_AT }],
		["a missing email id", { ...resendPayload("email.opened"), data: { to: "a@b.no" } }],
		["non-objects", null],
	])("ignores %s", (_, payload) => {
		expect(capturedEmailEvent(payload)).toBeNull();
	});
});

describe("capture", () => {
	const args = {
		type: "email.opened" as const,
		emailId: "re_123",
		recipient: " Student@Example.com ",
		createdAt: CREATED_AT,
	};

	it("captures an open for a known user under their Clerk ID", async () => {
		const { t } = await setup();
		await insertUser(t, "student@example.com", { externalId: "user_clerk" });
		const sent = stubPostHog();
		await t.action(internal.emailAnalytics.capture.capture, args);
		expect(sent()).toEqual([
			{
				api_key: "phc_test",
				event: "resend-email_opened",
				distinct_id: "user_clerk",
				timestamp: CREATED_AT,
				properties: { email_id: "re_123", recipient_type: "user" },
			},
		]);
	});

	it("counts other recipients by a hash, without a person profile", async () => {
		const { t } = await setup();
		await insertUser(t, "student@example.com", { externalId: "user_clerk", deleted: true });
		const sent = stubPostHog();
		await t.action(internal.emailAnalytics.capture.capture, { ...args, type: "email.delivered" });
		expect(sent()).toEqual([
			expect.objectContaining({
				event: "resend-email_delivered",
				distinct_id: `email:${await sha256("student@example.com")}`,
				properties: {
					email_id: "re_123",
					recipient_type: "external",
					$process_person_profile: false,
				},
			}),
		]);
	});

	it("does nothing without a PostHog token", async () => {
		const { t } = await setup();
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		await t.action(internal.emailAnalytics.capture.capture, args);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("fails so the scheduler logs a PostHog error", async () => {
		const { t } = await setup();
		stubPostHog();
		vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
		await expect(t.action(internal.emailAnalytics.capture.capture, args)).rejects.toThrow("503");
	});
});

describe("Resend webhook", () => {
	it("schedules a PostHog capture for a verified open", async () => {
		const { t } = await setup();
		const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
		feedbackResend.config.webhookSecret = secret;
		const body = JSON.stringify(resendPayload("email.opened"));
		const headers = {
			"svix-id": "msg_open",
			"svix-timestamp": String(Math.floor(Date.now() / 1000)),
			"svix-signature": new Webhook(secret).sign("msg_open", new Date(), body),
		};
		expect((await t.fetch("/resend-webhook", { method: "POST", body, headers })).status).toBe(201);
		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		expect(scheduled.filter((job) => job.name.endsWith("capture:capture"))).toMatchObject([
			{ args: [{ type: "email.opened", emailId: "re_123", recipient: "Student@Example.com" }] },
		]);
	});
});
