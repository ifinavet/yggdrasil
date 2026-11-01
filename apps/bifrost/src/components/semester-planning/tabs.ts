export const TABS = [
	{ value: "plan", label: "Plan", plannerOnly: false },
	{ value: "fordeling", label: "Fordeling", plannerOnly: true },
	{ value: "soknader", label: "Søknader", plannerOnly: true },
	{ value: "innstillinger", label: "Innstillinger", plannerOnly: true },
] as const;

export type Tab = (typeof TABS)[number]["value"];

export function visibleTabs(canPlan: boolean) {
	return TABS.filter((tab) => canPlan || !tab.plannerOnly);
}
