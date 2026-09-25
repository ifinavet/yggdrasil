import { SemesterPlanningGate } from "@workspace/ui/components/semester-planning-gate";
import NotFound from "../not-found";

/** The application form and receipt exist only while semester planning is enabled. */
export default function CompanyApplicationLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return <SemesterPlanningGate fallback={<NotFound />}>{children}</SemesterPlanningGate>;
}
