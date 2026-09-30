"use client";

import {
	type ChecklistPhase,
	type ChecklistStep,
	EVENT_CHECKLIST,
} from "@workspace/shared/events/checklist";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import styles from "./event-checklist.module.css";

export type ChecklistMilestone = {
	id: ChecklistPhase;
	date: string;
	overdue?: boolean;
	automation?: readonly string[];
};

export function EventChecklist({
	currentPhase,
	helpersLabel,
	milestones,
	completed,
	saving,
	onToggle,
}: Readonly<{
	currentPhase: ChecklistPhase;
	helpersLabel: string;
	milestones: readonly ChecklistMilestone[];
	completed: ReadonlySet<string>;
	saving: boolean;
	onToggle: (id: ChecklistStep, checked: boolean) => void;
}>) {
	const [selection, setSelection] = useState<ChecklistPhase>();
	const [expanded, setExpanded] = useState(true);
	const selected = selection ?? currentPhase;
	const panelId = useId();
	const phase = EVENT_CHECKLIST.find((item) => item.id === selected) ?? EVENT_CHECKLIST[0];
	const milestone = milestones.find((item) => item.id === selected);
	const overdue = milestone?.overdue && phase.steps.some((step) => !completed.has(step.id));
	const allSteps = EVENT_CHECKLIST.flatMap((item) => [...item.steps]);
	const completedCount = allSteps.filter((step) => completed.has(step.id)).length;

	const countFor = (id: ChecklistPhase) => {
		const steps = EVENT_CHECKLIST.find((entry) => entry.id === id)?.steps ?? [];
		return `${steps.filter((step) => completed.has(step.id)).length}/${steps.length}`;
	};
	return (
		<section aria-label="Sjekkliste" className={cn(styles.checklist, "mb-2")} id="event-checklist">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div className="flex items-baseline gap-3">
					<h2 className={styles.title}>Sjekkliste</h2>
					<span className="text-muted-foreground text-xs tabular-nums">
						{completedCount} av {allSteps.length} fullført
					</span>
				</div>
				<button
					type="button"
					aria-expanded={expanded}
					aria-controls={panelId}
					onClick={() => setExpanded(!expanded)}
					className="inline-flex items-center gap-1 rounded-sm text-muted-foreground text-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{expanded ? "Skjul" : "Vis"}
					{expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
				</button>
			</div>

			<div id={panelId} hidden={!expanded}>
				<nav className={styles.phases} aria-label="Velg fase">
					{EVENT_CHECKLIST.map((item) => (
						<button
							type="button"
							className={styles.phase}
							key={item.id}
							aria-pressed={selected === item.id}
							onClick={() => setSelection(item.id)}
						>
							{item.label}
							<span
								className={cn(
									styles.count,
									milestones.find((entry) => entry.id === item.id)?.overdue &&
										item.steps.some((step) => !completed.has(step.id)) &&
										styles.overdue,
								)}
							>
								{countFor(item.id)}
							</span>
						</button>
					))}
				</nav>
				<div className={styles.context}>
					<h3>
						{
							{
								planning: "Planlegg med bedriften",
								registration: "Før påmeldingen åpner",
								preparation: "Gjør klart til arrangementet",
								event: "På arrangementsdagen",
								followup: "Følg opp etter arrangementet",
							}[selected]
						}
					</h3>
					<span className={cn(overdue && styles.overdue)}>
						{overdue && "Forfalt: "}
						{milestone?.date}
					</span>
				</div>
				<ul aria-label={phase.label} className={styles.tasks}>
					{phase.steps.map((step) => (
						<li key={step.id} className="flex min-h-9 items-center gap-2.5">
							<Checkbox
								id={`${panelId}-${step.id}`}
								checked={completed.has(step.id)}
								disabled={saving || step.id === "description"}
								className={step.id === "description" ? "disabled:opacity-100" : undefined}
								onCheckedChange={(checked) => onToggle(step.id, checked === true)}
							/>
							<label
								htmlFor={`${panelId}-${step.id}`}
								className={cn(
									styles.taskLabel,
									completed.has(step.id) && "text-muted-foreground line-through",
								)}
							>
								{step.id === "helpers" ? helpersLabel : step.label}
							</label>
						</li>
					))}
				</ul>
				{milestone?.automation && (
					<div className={styles.automatic}>
						<ul className={styles.automationSteps}>
							{milestone.automation.map((description) => (
								<li key={description}>{description}</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</section>
	);
}
