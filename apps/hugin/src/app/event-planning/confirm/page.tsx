import type { Metadata } from "next";
import { ConfirmPlanning } from "@/components/event-planning/company-planning";
export const metadata: Metadata = {
	title: "Bekreft opplysningene",
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};
export default function Page() {
	return <ConfirmPlanning />;
}
