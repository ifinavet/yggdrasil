import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WikiHeader } from "@/components/wiki/shared";
export const metadata: Metadata = { title: "Håndbok" };
export default function WikiLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
			<WikiHeader />
			{children}
		</div>
	);
}
