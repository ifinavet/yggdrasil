"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { semesterName } from "@workspace/shared/semester/labels";
import { convexErrorMessage } from "@workspace/shared/utils";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
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
	const [open, setOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const name = semesterName(semester.term, semester.year);
	const isOpen = semester.status === "open";

	const remove = async () => {
		setDeleting(true);
		try {
			const { applications } = await deleteSemester({ semesterId: semester._id });
			setOpen(false);
			toast.success(deletedMessage(name, applications));
		} catch (error) {
			toast.error("Kunne ikke slette semesteret", {
				description: convexErrorMessage(error, "Prøv igjen."),
			});
		} finally {
			setDeleting(false);
		}
	};

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
			<AlertDialog open={open} onOpenChange={setOpen}>
				<AlertDialogTrigger asChild>
					<Button type="button" variant="outline" size="sm" disabled={isOpen}>
						<Trash2 /> Slett
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Slette {semesterName(semester.term, semester.year, { inSentence: true })}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Semesteret slettes for godt, med alle datoer, søknader, tilbud, historikk og søknader
							som venter på bekreftelse på e-post. Arrangementer lagt inn i planen blir liggende.
							Dette kan ikke angres.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
						<Button variant="destructive" disabled={deleting} onClick={remove}>
							{deleting ? "Sletter …" : `Slett ${name}`}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
