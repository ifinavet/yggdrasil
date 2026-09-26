import { FeatureGate } from "@workspace/ui/components/feature-gate";
import NotFound from "../not-found";

export default function JobListingOrderLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<FeatureGate feature="jobListingOrders" fallback={<NotFound />}>
			{children}
		</FeatureGate>
	);
}
