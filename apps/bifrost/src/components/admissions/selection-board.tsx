"use client";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useState } from "react";
import { type Candidate, type Decision, decisionLabels, decisions } from "./model";
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
		<div className="admissions-board">
			{decisions.map((status) => (
				<section
					className={`admissions-lane admissions-lane-${status}`}
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
								className="admissions-candidate"
								key={c.id}
								draggable={!c.decisionLocked}
								onDragStart={() => setDragging(c.id)}
								onDragEnd={() => setDragging(null)}
							>
								<button type="button" onClick={() => onSelect(c.id)}>
									<strong>{c.name}</strong>
									<span>{c.program}</span>
									<div>
										<span>{c.year}. år</span>
										<span>{c.group}</span>
									</div>
								</button>
								<Select
									value={c.decision}
									disabled={c.decisionLocked}
									onValueChange={(value) => onDecisionChange(c.id, value as Decision)}
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
