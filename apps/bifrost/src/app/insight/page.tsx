import { Callout } from "@workspace/ui/components/products/callout";
import { EngagementBreadcrumb } from "@/components/engagement/engagement-breadcrumb";
import { EngagementDashboard } from "@/components/engagement/engagement-dashboard";

export const instant = false;

export default function EngagementPage() {
	return (
		<>
			<EngagementBreadcrumb />
			<Callout className="mb-4">
				Siden er under utvikling, og vi jobber fortsatt med datagrunnlaget. Tallene er stort sett
				nøyaktige, men kan avvike med noen få prosent enkelte steder.
			</Callout>
			<EngagementDashboard />
		</>
	);
}
