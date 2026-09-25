import type { Metadata } from "next";
import { ApplicationReceipt } from "@/components/company-application/application-receipt";

export const metadata: Metadata = {
	title: "Søknaden er sendt",
	robots: { index: false },
};

// Shown behind the semester planning gate, which only renders in the browser.
export const instant = false;

export default function Page() {
	return (
		<div className="mx-auto w-full max-w-2xl">
			<ApplicationReceipt />
		</div>
	);
}
