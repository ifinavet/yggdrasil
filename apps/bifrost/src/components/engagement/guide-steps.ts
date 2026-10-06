import type { EngagementGuideStep } from "@workspace/shared/engagement/guide";

export function liveGuideSteps({
	live,
	eventCount,
	alertCount,
	selected,
	curve,
}: Readonly<{
	live: boolean;
	eventCount: number | undefined;
	alertCount: number;
	selected: boolean;
	curve: { projected: number | null } | null | undefined;
}>) {
	const steps = new Set<EngagementGuideStep>();
	if (!live || eventCount === undefined) return steps;
	if (selected && curve === undefined) return steps;
	steps.add("past");
	if (curve?.projected != null) steps.add("prognosis");
	if (eventCount > 1) steps.add("select");
	if (alertCount > 0) steps.add("alerts");
	return steps;
}
