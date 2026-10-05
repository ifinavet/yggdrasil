import { FeatureGate } from "@workspace/ui/components/feature-gate";
import NotFound from "../../not-found";

export default function FoodLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return (
		<FeatureGate feature="food" fallback={<NotFound />}>
			{children}
		</FeatureGate>
	);
}
