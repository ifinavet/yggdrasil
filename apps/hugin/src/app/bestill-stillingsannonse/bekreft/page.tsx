import type { Metadata } from "next";
import { ConfirmOrderPage } from "@/components/job-listing-order/confirm-order-page";
import { confirmCopy } from "@/lib/job-listing-order/copy";

export const metadata: Metadata = {
	title: confirmCopy.title,
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};
export default function Page() {
	return <ConfirmOrderPage />;
}
