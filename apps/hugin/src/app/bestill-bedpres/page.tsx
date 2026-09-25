import type { Metadata } from "next";
import { CompanyApplication } from "@/components/company-application/company-application";

export const metadata: Metadata = {
	title: "Søk om bedriftsarrangement",
	description:
		"Søk om å holde bedriftspresentasjon eller annet arrangement for informatikkstudentene.",
};

// Shown behind the semester planning gate, which only renders in the browser.
export const instant = false;

export default function Page() {
	return (
		<div className="mx-auto flex min-h-full w-full max-w-2xl flex-col">
			<CompanyApplication />
		</div>
	);
}
