import type { EmailId } from "@convex-dev/resend";
import { EVENT_CONTACT_EMAIL, INFO_EMAIL } from "@workspace/shared/constants/contact";
import type { ActionCtx } from "../../_generated/server";
import { isLocalDevelopment } from "../../auth/local";
import { trackedEmail } from "../../lib/trackedEmail";

export type AdmissionEmail = Readonly<{
	to: string;
	subject: string;
	html: string;
	text: string;
	idempotencyKey: string;
}>;

export async function sendAdmissionEmail(ctx: ActionCtx, email: AdmissionEmail): Promise<string> {
	if (isLocalDevelopment()) return `local:${email.idempotencyKey}`;
	return (await trackedEmail.sendEmail(ctx, {
		from: `Navet <${INFO_EMAIL}>`,
		replyTo: [EVENT_CONTACT_EMAIL],
		...email,
	})) as EmailId;
}
