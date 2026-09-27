import { FeatureGate } from "@workspace/ui/components/feature-gate";
import type { Metadata } from "next";
import NotFound from "../not-found";

export const metadata: Metadata = {
	title: "Engasjement",
};

export default function EngagementLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return (
		<FeatureGate feature="engagement" fallback={<NotFound />}>
			{children}
		</FeatureGate>
	);
}
