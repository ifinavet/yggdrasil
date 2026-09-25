"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { SEMESTER_LABEL, semesterName } from "@workspace/shared/semester/labels";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ApplicationsTab } from "./applications-tab";
import { DistributionTab } from "./distribution-tab";
import { PlanTab } from "./plan-tab";
import { SemesterActionsSlot } from "./semester-actions";
import { FirstSemester, SettingsTab } from "./settings-tab";

const TABS = [
	{ value: "plan", label: "Plan", editorOnly: false },
	{ value: "fordeling", label: "Fordeling", editorOnly: true },
	{ value: "soknader", label: "Søknader", editorOnly: true },
	{ value: "innstillinger", label: "Innstillinger", editorOnly: true },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** The semester the page opens on: the open one, else the newest. */
function defaultSemester(semesters: Doc<"semesters">[]) {
	return semesters.find((semester) => semester.status === "open") ?? semesters[0];
}

/**
 * The Semesterplan page: a semester select and the Plan, Fordeling, Søknader and Innstillinger
 * tabs. The semester and tab live in the URL (`?semester=` and `?tab=`), so links and reloads keep
 * them. Plan opens first; internal members only see Plan.
 */
export function SemesterPlanner({
	preloadedSemesters,
	canEdit,
}: Readonly<{
	preloadedSemesters: Preloaded<typeof api.semesterPlanning.semesters.queries.list>;
	canEdit: boolean;
}>) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);

	const semesters = usePreloadedQuery(preloadedSemesters);
	const selected =
		semesters.find((semester) => semester._id === searchParams.get("semester")) ??
		defaultSemester(semesters);

	const tabs = TABS.filter((tab) => canEdit || !tab.editorOnly);
	const requestedTab = searchParams.get("tab");
	const tab = tabs.find((item) => item.value === requestedTab)?.value ?? tabs[0]?.value;

	const applicationCount = useQuery(
		api.semesterPlanning.applications.queries.listForSemester,
		canEdit && selected ? { semesterId: selected._id } : "skip",
	)?.length;

	const navigate = useCallback(
		(changes: { semester?: Id<"semesters">; tab?: Tab }) => {
			const params = new URLSearchParams(searchParams);
			if (changes.semester) params.set("semester", changes.semester);
			if (changes.tab) params.set("tab", changes.tab);
			router.replace(`${pathname}?${params.toString()}`, { scroll: false });
		},
		[pathname, router, searchParams],
	);

	if (!selected) {
		return canEdit ? (
			<FirstSemester onCreated={(semester) => navigate({ semester, tab: "innstillinger" })} />
		) : (
			<div className="rounded-lg border bg-card px-4 py-14 text-center">
				<p className="font-semibold">Ingen semestre ennå</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Bedriftskontakten oppretter semesteret i Bifrost.
				</p>
			</div>
		);
	}

	return (
		<SemesterActionsSlot.Provider value={actionsSlot}>
			<div className="flex flex-wrap items-center gap-3">
				<Select
					value={selected._id}
					onValueChange={(value) => navigate({ semester: value as Id<"semesters"> })}
				>
					<SelectTrigger className="min-w-[150px]" aria-label={SEMESTER_LABEL}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{semesters.map((semester) => (
							<SelectItem key={semester._id} value={semester._id}>
								{semesterName(semester.term, semester.year)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{tabs.length > 1 && (
					<Tabs
						value={tab}
						onValueChange={(value) => navigate({ tab: value as Tab })}
						className="min-w-0 max-w-full"
					>
						<TabsList className="max-w-full overflow-x-auto">
							{tabs.map((item) => (
								<TabsTrigger
									key={item.value}
									value={item.value}
									className="px-2 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_3px_rgb(0_0_0/0.1)] sm:px-3"
								>
									{item.label}
									{item.value === "soknader" && !!applicationCount && (
										<span className="rounded-full bg-primary-light px-1.5 text-primary text-xs tabular-nums dark:bg-muted dark:text-foreground">
											{applicationCount}
										</span>
									)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				)}

				{/* The open tab's buttons, at the far right. */}
				<div
					ref={setActionsSlot}
					className="flex min-w-0 flex-wrap items-center gap-3 sm:flex-1 sm:justify-end"
				/>
			</div>

			{/* Keyed by semester, so switching semester starts the Plan's filters over. */}
			{tab === "plan" && <PlanTab key={selected._id} semester={selected} canEdit={canEdit} />}
			{tab === "fordeling" && <DistributionTab semester={selected} />}
			{tab === "soknader" && <ApplicationsTab semester={selected} />}
			{tab === "innstillinger" && (
				<SettingsTab
					semester={selected}
					onCreated={(semester) => navigate({ semester, tab: "innstillinger" })}
				/>
			)}
		</SemesterActionsSlot.Provider>
	);
}
