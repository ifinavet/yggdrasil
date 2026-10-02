import type { Metadata } from "next";
import { CompanyPlanning } from "@/components/event-planning/company-planning";
export const metadata: Metadata = {
	title: "Planlegg arrangementet",
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};
export default function Page() {
	return <CompanyPlanning />;
}
