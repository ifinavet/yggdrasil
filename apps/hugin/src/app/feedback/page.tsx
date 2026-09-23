import type { Metadata } from "next";
import { TokenFeedbackPage } from "@/components/feedback/token-feedback-page";

export const metadata: Metadata = {
	title: "Tilbakemelding",
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};
export default function Page() {
	return <TokenFeedbackPage />;
}
