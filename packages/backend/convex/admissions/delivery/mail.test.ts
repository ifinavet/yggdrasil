import { afterEach, describe, expect, it, vi } from "vitest";
import { trackedEmail } from "../../lib/trackedEmail";
import { sendAdmissionEmail } from "./mail";

const email = {
	to: "applicant@example.test",
	subject: "Opptaksintervju",
	html: "<p>Hei</p>",
	text: "Hei",
	idempotencyKey: "admission:interview:revision-1",
};
const ctx = {} as never;

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.CONVEX_CLOUD_URL;
	delete process.env.APP_ENV;
});

describe("admissions email provider", () => {
	it("captures a stable delivery id locally without invoking Resend", async () => {
		process.env.CONVEX_CLOUD_URL = "http://127.0.0.1:3210";
		process.env.APP_ENV = "local";
		const send = vi.spyOn(trackedEmail, "sendEmail");
		await expect(sendAdmissionEmail(ctx, email)).resolves.toBe(`local:${email.idempotencyKey}`);
		expect(send).not.toHaveBeenCalled();
	});

	it("passes the durable idempotency key to Resend and exposes provider failures for retry", async () => {
		process.env.CONVEX_CLOUD_URL = "https://deployment.convex.cloud";
		process.env.APP_ENV = "production";
		const send = vi.spyOn(trackedEmail, "sendEmail").mockResolvedValue("re_email_id" as never);
		await expect(sendAdmissionEmail(ctx, email)).resolves.toBe("re_email_id");
		expect(send).toHaveBeenCalledWith(
			ctx,
			expect.objectContaining({
				to: email.to,
				subject: email.subject,
				idempotencyKey: email.idempotencyKey,
			}),
		);
		send.mockRejectedValueOnce(new Error("Resend unavailable"));
		await expect(sendAdmissionEmail(ctx, email)).rejects.toThrow("Resend unavailable");
	});
});
