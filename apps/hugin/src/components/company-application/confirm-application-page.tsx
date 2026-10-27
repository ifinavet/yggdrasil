"use client";

import { api } from "@workspace/backend/convex/api";
import { EmailLinkConfirmPage } from "@/components/email-link-confirm-page";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import { ApplicationReceipt } from "./application-receipt";

const confirmation = api.semesterPlanning.applications.confirmation;

/**
 * /bestill-bedpres/bekreft#token=…: where the link in the confirmation email leads. The application
 * reaches Navet when the company presses confirm; after that the link shows the receipt.
 */
export function ConfirmApplicationPage() {
	return (
		<EmailLinkConfirmPage
			link={confirmation.link}
			confirm={confirmation.confirm}
			copy={COPY.confirm}
			formPath="/bestill-bedpres"
			Receipt={ApplicationReceipt}
		/>
	);
}
