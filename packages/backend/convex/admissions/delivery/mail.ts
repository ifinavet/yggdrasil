import type { EmailId } from "@convex-dev/resend";
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
		from: "Navet <info@ifinavet.no>",
		replyTo: ["arrangement@ifinavet.no"],
		...email,
	})) as EmailId;
}
