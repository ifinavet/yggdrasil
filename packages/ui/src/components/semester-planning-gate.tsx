"use client";

import { FeatureGate } from "@workspace/ui/components/feature-gate";
import type { ReactNode } from "react";

export function SemesterPlanningGate({
	children,
	fallback,
}: Readonly<{ children: ReactNode; fallback?: ReactNode }>) {
	return (
		<FeatureGate feature="semesterPlanning" fallback={fallback}>
			{children}
		</FeatureGate>
	);
}
