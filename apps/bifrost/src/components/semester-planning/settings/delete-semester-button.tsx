"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { semesterName } from "@workspace/shared/semester/labels";
import { Button } from "@workspace/ui/components/button";
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function deletedMessage(name: string, applications: number): string {
	if (applications === 0) return `${name} er slettet.`;
	const count = applications === 1 ? "1 søknad" : `${applications} søknader`;
	return `${name} er slettet, med ${count}.`;
}

/**
 * «Slett semester»: deletes the semester with its dates, applications, offers and history after a
 * confirmation. An open semester must be closed for applications first; the backend also refuses
 * while the plan has made events or an application is invoiced, and its message is shown.
 */
export function DeleteSemesterButton({ semester }: Readonly<{ semester: Doc<"semesters"> }>) {
	const deleteSemester = useMutation(api.semesterPlanning.semesters.mutations.deleteSemester);
	const { error, run, clearError } = useAsyncAction();
	const [open, setOpen] = useState(false);
	const name = semesterName(semester.term, semester.year);
	const isOpen = semester.status === "open";

	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3">
			<div className="min-w-0">
				<p className="font-medium text-sm">Slett semester</p>
				<p className="text-muted-foreground text-xs">
					{isOpen
						? "Steng semesteret for søknader før du sletter det"
						: "Sletter datoer, søknader, tilbud og historikk"}
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={isOpen}
				onClick={() => {
					clearError();
					setOpen(true);
				}}
			>
				<Trash2 /> Slett
			</Button>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title={`Slette ${semesterName(semester.term, semester.year, { inSentence: true })}?`}
				description="Semesteret slettes for godt, med alle datoer, søknader, tilbud, historikk og søknader som venter på bekreftelse på e-post. Arrangementer lagt inn i planen blir liggende. Dette kan ikke angres."
				confirmLabel={`Slett ${name}`}
				destructive
				error={error}
				onConfirm={() =>
					run(
						() => deleteSemester({ semesterId: semester._id }),
						({ applications }) => toast.success(deletedMessage(name, applications)),
						"Kunne ikke slette semesteret.",
					)
				}
			/>
		</div>
	);
}
