import { afterEach, expect, it, vi } from "vitest";
import { admissionApplicationFixture, insertInterview } from "../../../../test/admissions-fixtures";
import { insertUser } from "../../../../test/fixtures";
import { internal } from "../../../_generated/api";
import * as config from "../../../iam/config";
import * as google from "../../../iam/googleCalendar";
import * as slack from "../../../iam/slack";
import { trackedEmail } from "../../../lib/trackedEmail";
import * as admissionsSlack from "../slack";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

it("retries decision email through the provider with a stable key and records only provider-confirmed delivery", async () => {
	vi.stubEnv("APP_ENV", "local");
	vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
	const { t, periodId, applicationId } = await admissionApplicationFixture(
		{},
		{ decision: "rejected", decisionRevision: 1, decisionQueuedAt: Date.now() },
	);
	const send = vi
		.spyOn(trackedEmail, "sendEmail")
		.mockRejectedValueOnce(new Error("Resend unavailable"))
		.mockResolvedValue("provider-email-id" as never);
	const operation = {
		kind: "send_decision" as const,
		periodId,
		applicationId,
		revision: 1,
		idempotencyKey: "decision-provider-retry",
		dueAt: Date.now(),
	};
	await expect(
		t.action(internal.admissions.delivery.actions.execute, { operation }),
	).rejects.toThrow("Resend unavailable");
	const unsent = await t.run((ctx) => ctx.db.get(applicationId));
	expect(unsent).not.toBeNull();
	expect(unsent?.decisionSentAt).toBeUndefined();
	expect(await t.run((ctx) => ctx.db.query("admissionDeliveries").collect())).toEqual([]);
	await t.action(internal.admissions.delivery.actions.execute, { operation });
	expect(send).toHaveBeenCalledTimes(2);
	for (const [, email] of send.mock.calls)
		expect(email).toMatchObject({
			to: "applicant@uio.no",
			idempotencyKey: `admission:decision:${applicationId}:1:rejection`,
			subject: expect.stringContaining("Svar på søknaden"),
			html: expect.stringContaining("<html"),
			text: expect.any(String),
		});
	expect(await t.run((ctx) => ctx.db.query("admissionDeliveries").collect())).toMatchObject([
		{ emailId: "provider-email-id", kind: "rejection", status: "queued" },
	]);
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toMatchObject({
		decisionSentAt: expect.any(Number),
	});
	await t.mutation(internal.admissions.delivery.tracking.recordProviderEvent, {
		emailId: "provider-email-id",
		type: "email.delivered",
	});
	await t.action(internal.admissions.delivery.actions.execute, { operation });
	expect(send).toHaveBeenCalledTimes(2);
	expect(await t.run((ctx) => ctx.db.query("admissionDeliveries").collect())).toMatchObject([
		{ status: "delivered" },
	]);
});

it("refuses publication when Google busy time cannot be accounted for by visible events", async () => {
	const { t, periodId, applicationId } = await admissionApplicationFixture({ status: "published" });
	const people = await Promise.all(
		["one@ifinavet.no", "two@ifinavet.no"].map((email) => insertUser(t, email)),
	);
	await t.run((ctx) =>
		ctx.db.patch(periodId, {
			interviewers: people.map(({ _id }) => ({ userId: _id, selectedCalendarIds: ["primary"] })),
		}),
	);
	const startAt = Date.now() + 3 * 86400000;
	const interviewId = await insertInterview(t, periodId, applicationId, {
		startAt,
		endAt: startAt + 15 * 60000,
		interviewerIds: people.map(({ _id }) => _id),
		selectedCalendarIds: ["primary"],
	});
	vi.spyOn(config, "googleConfig").mockReturnValue({
		serviceAccountEmail: "service@example.test",
		privateKey: "test-key",
		adminEmail: "admin@ifinavet.no",
		domain: "ifinavet.no",
	});
	const provider = {
		listCalendars: vi.fn(),
		freeBusy: vi.fn().mockResolvedValue({
			primary: {
				busy: [
					{
						start: new Date(startAt).toISOString(),
						end: new Date(startAt + 20 * 60000).toISOString(),
					},
				],
			},
		}),
		listEvents: vi.fn().mockResolvedValue([]),
		getEvent: vi.fn(),
		upsertEvent: vi.fn(),
		cancelEvent: vi.fn(),
	};
	vi.spyOn(google, "googleCalendarClient").mockReturnValue(provider);
	const send = vi.spyOn(trackedEmail, "sendEmail");
	await expect(
		t.action(internal.admissions.delivery.actions.execute, {
			operation: {
				kind: "publish",
				periodId,
				applicationId,
				interviewId,
				revision: 1,
				idempotencyKey: "unknown-busy",
				dueAt: Date.now(),
			},
		}),
	).rejects.toThrow("opptattstatus som ikke kan kontrolleres");
	expect(provider.upsertEvent).not.toHaveBeenCalled();
	expect(send).not.toHaveBeenCalled();
	expect((await t.run((ctx) => ctx.db.get(interviewId)))?.publishedAt).toBeUndefined();
});

it.each([false, true])(
	"notifies the board when an interview is cancelled (applicant email: %s)",
	async (notifyApplicant) => {
		const { t, periodId, applicationId } = await admissionApplicationFixture();
		const owner = await insertUser(t, "interviewer@ifinavet.no");
		const interviewId = await insertInterview(t, periodId, applicationId, {
			status: "cancelled",
			interviewerIds: [owner._id],
			startAt: Date.now() + 86400000,
		});
		vi.spyOn(config, "googleConfig").mockReturnValue({
			serviceAccountEmail: "service@example.test",
			privateKey: "test-key",
			adminEmail: "admin@ifinavet.no",
			domain: "ifinavet.no",
		});
		vi.spyOn(google, "googleCalendarClient").mockReturnValue({
			listCalendars: vi.fn(),
			freeBusy: vi.fn(),
			listEvents: vi.fn(),
			getEvent: vi.fn().mockResolvedValue(null),
			upsertEvent: vi.fn(),
			cancelEvent: vi.fn(),
		});
		vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
		vi.spyOn(admissionsSlack, "ensureAdmissionsChannel").mockResolvedValue("C-admissions");
		const notice = vi.spyOn(slack, "postSlackNotice").mockResolvedValue(undefined);
		const email = vi.spyOn(trackedEmail, "sendEmail").mockResolvedValue("cancel-email" as never);
		await t.action(internal.admissions.delivery.actions.execute, {
			operation: {
				kind: "cancel_interview",
				periodId,
				applicationId,
				interviewId,
				revision: 1,
				idempotencyKey: "cancel-notice",
				dueAt: Date.now(),
				notifyApplicant,
			},
		});
		expect(notice).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			"C-admissions",
			`cancelled:${interviewId}:1`,
			expect.any(Number),
			expect.stringContaining("avlyst"),
		);
		expect(email).toHaveBeenCalledTimes(notifyApplicant ? 1 : 0);
	},
);
