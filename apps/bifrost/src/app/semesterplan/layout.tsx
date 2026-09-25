import { SemesterPlanningGate } from "@workspace/ui/components/semester-planning-gate";
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
	return <SemesterPlanningGate fallback={<NotFound />}>{children}</SemesterPlanningGate>;
}
