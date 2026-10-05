import { afterEach, expect, it, vi } from "vitest";
import { admissionApplicationFixture } from "../../../../test/admissions-fixtures";
import { internal } from "../../../_generated/api";
import { trackedEmail } from "../../../lib/trackedEmail";

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
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toMatchObject({ sent: false });
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
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toMatchObject({ sent: true });
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
