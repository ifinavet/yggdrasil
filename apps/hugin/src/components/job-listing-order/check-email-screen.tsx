"use client";

import { api } from "@workspace/backend/convex/api";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { useAction } from "convex/react";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { checkEmailCopy } from "@/lib/job-listing-order/copy";

type ResendState = { status: "idle" | "sending" | "sent" } | { status: "failed"; message: string };

export function CheckEmailScreen({
	email,
	submissionId,
}: Readonly<{ email: string; submissionId: string }>) {
	const resendConfirmation = useAction(api.jobListingOrders.submit.resendConfirmation);
	const [resend, setResend] = useState<ResendState>({ status: "idle" });

	const onResend = async () => {
		setResend({ status: "sending" });
		try {
			await resendConfirmation({ submissionId });
			setResend({ status: "sent" });
		} catch (error) {
			setResend({ status: "failed", message: convexErrorMessage(error, checkEmailCopy.failed) });
		}
	};

	return (
		<div className="mx-auto w-full max-w-3xl">
			<FormStatePanel
				icon={<MailCheck className="size-6" />}
				title={checkEmailCopy.title}
				body={checkEmailCopy.body(email)}
				action={
					<Button
						type="button"
						variant="outline"
						disabled={resend.status === "sending"}
						onClick={onResend}
					>
						{resend.status === "sending" ? checkEmailCopy.resending : checkEmailCopy.resend}
					</Button>
				}
				quiet={
					<output
						aria-live="polite"
						className={resend.status === "failed" ? "text-destructive" : undefined}
					>
						{resend.status === "sent" && checkEmailCopy.resent}
						{resend.status === "failed" && resend.message}
					</output>
				}
			/>
		</div>
	);
}
