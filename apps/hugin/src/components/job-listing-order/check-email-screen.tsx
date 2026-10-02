"use client";
import { api } from "@workspace/backend/convex/api";
import { useAction } from "convex/react";
import { EmailCheckScreen } from "@/components/email-check-screen";

export function CheckEmailScreen({
	email,
	submissionId,
}: Readonly<{ email: string; submissionId: string }>) {
	const resend = useAction(api.jobListingOrders.submit.resendConfirmation);
	return (
		<div className="mx-auto w-full max-w-3xl">
			<EmailCheckScreen email={email} onResend={() => resend({ submissionId })} />
		</div>
	);
}
