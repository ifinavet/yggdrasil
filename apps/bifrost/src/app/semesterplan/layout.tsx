import { FeatureGate } from "@workspace/ui/components/feature-gate";
import type { Metadata } from "next";
import NotFound from "../not-found";

export const metadata: Metadata = {
	title: "Semesterplan",
};

export default function SemesterPlanLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return (
		<FeatureGate feature="semesterPlanning" fallback={<NotFound />}>
			{children}
		</FeatureGate>
	);
}
