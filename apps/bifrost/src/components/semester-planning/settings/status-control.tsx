"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

type Status = Doc<"semesters">["status"];

/** What changed, from the status the semester had to the one it got. */
function doneMessage(from: Status, to: Status): string {
	if (to === "open") return "Semesteret er åpnet for søknader.";
	if (to === "closed") return "Semesteret er låst.";
	return from === "closed"
		? "Semesteret er låst opp som utkast."
		: "Semesteret tar ikke lenger imot søknader.";
}

const listFormat = new Intl.ListFormat("nb", { type: "conjunction" });

/** What is still missing before the semester can open. */
function missingForOpen(semester: Doc<"semesters">): string[] {
	return [
		!semester.firstDate && "første dato",
		!semester.lastDate && "siste dato",
		!semester.applicationDeadline && "søknadsfrist",
	].filter((item): item is string => typeof item === "string");
}

function statusHelp(semester: Doc<"semesters">, missing: string[]) {
	if (semester.status === "open") return "Skjemaet på Hugin tar imot søknader";
	if (semester.status === "closed") return "Semesteret er over og låst";
	if (missing.length > 0) return `Sett ${listFormat.format(missing)} først`;
	return "Ikke åpnet for søknader ennå";
}

/**
 * «Åpne for søknader»: a switch that opens the semester for applications on Hugin or sets it back
 * to a draft. The rollover job closes a semester once its last date has passed; a closed semester
 * can be unlocked as a draft again.
 */
export function StatusControl({ semester }: Readonly<{ semester: Doc<"semesters"> }>) {
	const setStatus = useMutation(api.semesterPlanning.semesters.mutations.setStatus);
	const [pending, setPending] = useState(false);
	const missing = missingForOpen(semester);
	const isOpen = semester.status === "open";

	async function change(status: Status) {
		if (status === semester.status || pending) return;
		setPending(true);
		try {
			await setStatus({ semesterId: semester._id, status });
			toast.success(doneMessage(semester.status, status));
		} catch (error) {
			toast.error("Kunne ikke endre status", {
				description: convexErrorMessage(error, "Prøv igjen."),
			});
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border p-3">
			<div className="min-w-0">
				<p id="semester-status-label" className="font-medium text-sm">
					Åpne for søknader
				</p>
				<p className="text-muted-foreground text-xs">{statusHelp(semester, missing)}</p>
			</div>
			{semester.status === "closed" ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={pending}
					onClick={() => void change("draft")}
				>
					Lås opp
				</Button>
			) : (
				<Switch
					checked={isOpen}
					aria-labelledby="semester-status-label"
					disabled={pending || (!isOpen && missing.length > 0)}
					onCheckedChange={(open) => void change(open ? "open" : "draft")}
				/>
			)}
		</div>
	);
}
