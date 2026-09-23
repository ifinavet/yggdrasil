import type { Metadata } from "next";
import { CompanyReportPage } from "@/components/feedback/company-report-page";

export const metadata: Metadata = {
	title: "Rapport fra bedriftspresentasjon",
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};
export default function Page() {
	return <CompanyReportPage />;
}
