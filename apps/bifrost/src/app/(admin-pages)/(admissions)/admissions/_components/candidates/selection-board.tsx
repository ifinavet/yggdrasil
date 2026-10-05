"use client";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useState } from "react";
import { type Candidate, type Decision, decisionLabels, decisionLocked, decisions } from "../model";
export function SelectionBoard({
	candidates,
	onSelect,
	onDecisionChange,
}: Readonly<{
	candidates: Candidate[];
	onSelect: (id: string) => void;
	onDecisionChange: (id: string, decision: Decision) => void;
}>) {
	const [dragging, setDragging] = useState<string | null>(null);
	return (
		<div className="admissions-board grid min-w-0 grid-cols-[repeat(4,minmax(240px,1fr))] items-start gap-4 overflow-x-auto pb-3">
			{decisions.map((status) => (
				<section
					className={`admissions-lane flex min-h-72 flex-col gap-3 rounded-xl p-3 [&_h2]:flex [&_h2]:justify-between [&_h2]:gap-2 [&_h2]:pb-2 [&_h2]:font-semibold [&_h2]:text-sm [&_h2_span]:text-muted-foreground ${status === "accepted" ? "bg-emerald-50 dark:bg-emerald-950" : "bg-muted"}`}
					key={status}
					onDragOver={(e) => e.preventDefault()}
					onDrop={(e) => {
						e.preventDefault();
						if (dragging) {
							onDecisionChange(dragging, status);
							setDragging(null);
						}
					}}
					aria-label={decisionLabels[status]}
				>
					<h2>
						{decisionLabels[status]}
						<span>{candidates.filter((c) => c.decision === status).length}</span>
					</h2>
					{candidates
						.filter((c) => c.decision === status)
						.map((c) => (
							<article
								className="admissions-candidate rounded-lg border bg-background p-3 [&>button:not([data-slot=select-trigger])]:flex [&>button:not([data-slot=select-trigger])]:w-full [&>button:not([data-slot=select-trigger])]:cursor-pointer [&>button:not([data-slot=select-trigger])]:flex-col [&>button:not([data-slot=select-trigger])]:gap-2 [&>button:not([data-slot=select-trigger])]:text-left [&_[data-slot=select-trigger]]:mt-3 [&_button>div]:flex [&_button>div]:w-full [&_button>div]:justify-between [&_button>div]:gap-2 [&_button>div]:text-xs [&_button>span]:text-muted-foreground [&_button>span]:text-xs [&_strong]:text-sm"
								key={c._id}
								draggable={!decisionLocked(c)}
								onDragStart={() => setDragging(c._id)}
								onDragEnd={() => setDragging(null)}
							>
								<button type="button" onClick={() => onSelect(c._id)}>
									<strong>{c.name}</strong>
									<span>{c.program}</span>
									<div>
										<span>{c.year}. år</span>
										<span>{c.group}</span>
									</div>
								</button>
								<Select
									value={c.decision}
									disabled={decisionLocked(c)}
									onValueChange={(value) => onDecisionChange(c._id, value as Decision)}
								>
									<SelectTrigger aria-label={`Flytt ${c.name}`} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{decisions.map((d) => (
											<SelectItem key={d} value={d}>
												{decisionLabels[d]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</article>
						))}
				</section>
			))}
		</div>
	);
}
