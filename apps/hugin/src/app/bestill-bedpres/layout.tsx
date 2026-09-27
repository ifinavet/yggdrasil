import { FeatureGate } from "@workspace/ui/components/feature-gate";
import NotFound from "../not-found";

/** The application form and receipt exist only while semester planning is enabled. */
export default function CompanyApplicationLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<FeatureGate feature="semesterPlanning" fallback={<NotFound />}>
			{children}
		</FeatureGate>
	);
}
