import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = { title: "Håndbok" };
export default function WikiLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className="@container mx-auto w-full min-w-0 max-w-4xl space-y-8 py-4 pb-12">
			{children}
		</div>
	);
}
