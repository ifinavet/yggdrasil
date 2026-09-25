import type { Metadata } from "next";
import { OrderPage } from "@/components/job-listing-order/order-page";
import { orderPageCopy } from "@/lib/job-listing-order/copy";

export const metadata: Metadata = {
	title: orderPageCopy.title,
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};
export default function Page() {
	return <OrderPage />;
}
