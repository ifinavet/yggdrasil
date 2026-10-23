"use client";

import { api } from "@workspace/backend/convex/api";
import { JOB_LISTING_ORDER_PATH } from "@workspace/shared/job-listing-orders";
import { EmailLinkConfirmPage } from "@/components/email-link-confirm-page";
import { confirmCopy } from "@/lib/job-listing-order/copy";
import { OrderReceipt } from "./order-receipt";

export function ConfirmOrderPage() {
	return (
		<div className="mx-auto w-full max-w-3xl print:max-w-none">
			<EmailLinkConfirmPage
				link={api.jobListingOrders.orders.link}
				confirm={api.jobListingOrders.orders.confirm}
				copy={confirmCopy}
				formPath={JOB_LISTING_ORDER_PATH}
				Receipt={OrderReceipt}
			/>
		</div>
	);
}
