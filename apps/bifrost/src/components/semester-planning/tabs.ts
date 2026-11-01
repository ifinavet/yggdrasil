// The Semesterplan tabs. Plan is for every internal member; the rest are for those who plan the
// semester: the board, the members it gave access, and super-admins.
export const TABS = [
	{ value: "plan", label: "Plan", plannerOnly: false },
	{ value: "fordeling", label: "Fordeling", plannerOnly: true },
	{ value: "soknader", label: "Søknader", plannerOnly: true },
	{ value: "innstillinger", label: "Innstillinger", plannerOnly: true },
] as const;

export type Tab = (typeof TABS)[number]["value"];

/** The tabs the caller sees: all of them for a planner, else only Plan. */
export function visibleTabs(canPlan: boolean) {
	return TABS.filter((tab) => canPlan || !tab.plannerOnly);
}
