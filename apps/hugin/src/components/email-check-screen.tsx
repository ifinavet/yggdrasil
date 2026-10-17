"use client";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { emailCheckCopy as copy } from "@/lib/email-check-copy";

/** After a form is sent: what it waits for, and a way to send the confirmation email again. */
export function EmailCheckScreen({
	body,
	onResend,
}: Readonly<{ body: string; onResend: () => Promise<unknown> }>) {
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState("");
	async function resend() {
		setPending(true);
		setMessage("");
		try {
			await onResend();
			setMessage(copy.resent);
		} catch (error) {
			setMessage(convexErrorMessage(error, copy.failed));
		} finally {
			setPending(false);
		}
	}
	return (
		<FormStatePanel
			icon={<MailCheck className="size-6" />}
			title={copy.title}
			body={body}
			action={
				<Button type="button" variant="outline" disabled={pending} onClick={resend}>
					{pending ? copy.resending : copy.resend}
				</Button>
			}
			quiet={<output aria-live="polite">{message}</output>}
		/>
	);
}
