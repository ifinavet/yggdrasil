import { EngagementBreadcrumb } from "@/components/engagement/engagement-breadcrumb";
import { EngagementDashboard } from "@/components/engagement/engagement-dashboard";

export const instant = false;

export default function EngagementPage() {
	return (
		<>
			<EngagementBreadcrumb />
			<EngagementDashboard />
		</>
	);
}
