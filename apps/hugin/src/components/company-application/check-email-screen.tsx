"use client";

import { api } from "@workspace/backend/convex/api";
import { useAction } from "convex/react";
import { EmailCheckScreen } from "@/components/email-check-screen";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";

/** After sending: the application only reaches Navet once it is confirmed from the email. */
export function CheckEmailScreen({
	email,
	submissionId,
}: Readonly<{ email: string; submissionId: string }>) {
	const resend = useAction(api.semesterPlanning.applications.submit.resendConfirmation);
	return (
		<EmailCheckScreen
			email={email}
			body={COPY.checkEmail.body(email)}
			onResend={() => resend({ submissionId })}
		/>
	);
}
