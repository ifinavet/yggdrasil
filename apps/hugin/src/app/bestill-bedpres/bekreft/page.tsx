import type { Metadata } from "next";
import { ConfirmApplicationPage } from "@/components/company-application/confirm-application-page";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";

export const metadata: Metadata = {
	title: COPY.confirm.title,
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};

export default function Page() {
	return (
		<div className="mx-auto w-full max-w-2xl">
			<ConfirmApplicationPage />
		</div>
	);
}
