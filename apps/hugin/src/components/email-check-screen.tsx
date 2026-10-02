"use client";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { checkEmailCopy } from "@/lib/job-listing-order/copy";

export function EmailCheckScreen({
	email,
	onResend,
	body,
}: Readonly<{ email: string; body?: string; onResend: () => Promise<unknown> }>) {
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState("");
	async function resend() {
		setPending(true);
		setMessage("");
		try {
			await onResend();
			setMessage(checkEmailCopy.resent);
		} catch (error) {
			setMessage(convexErrorMessage(error, checkEmailCopy.failed));
		} finally {
			setPending(false);
		}
	}
	return (
		<FormStatePanel
			icon={<MailCheck className="size-6" />}
			title={checkEmailCopy.title}
			body={body ?? checkEmailCopy.body(email)}
			action={
				<Button type="button" variant="outline" disabled={pending} onClick={resend}>
					{pending ? checkEmailCopy.resending : checkEmailCopy.resend}
				</Button>
			}
			quiet={<output aria-live="polite">{message}</output>}
		/>
	);
}
