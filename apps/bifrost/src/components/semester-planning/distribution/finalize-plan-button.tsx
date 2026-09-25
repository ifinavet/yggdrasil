"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { semesterName } from "@workspace/shared/semester/labels";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { Note } from "@workspace/ui/components/note";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { convexErrorMessage } from "@/utils/convex-error";

type FinalizeResult = FunctionReturnType<
	typeof api.semesterPlanning.semesters.mutations.finalizePlan
>;

/**
 * «Ferdigstill plan»: marks the semester plan as finished after a confirmation, and makes an
 * unpublished event for every confirmed application. While applications still wait for an offer or
 * an answer the button is quieter and says how many; the backend then refuses, and its message is
 * shown. Afterwards it says how many events were made, and which companies need a profile first.
 */
export function FinalizePlanButton({
	semester,
	waiting,
}: Readonly<{ semester: Doc<"semesters">; waiting: number }>) {
	const finalized = semester.planFinalizedAt !== undefined;
	const finalizePlan = useMutation(api.semesterPlanning.semesters.mutations.finalizePlan);
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [result, setResult] = useState<FinalizeResult | null>(null);

	const finalize = async () => {
		setSaving(true);
		try {
			setResult(await finalizePlan({ semesterId: semester._id }));
			setOpen(false);
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke ferdigstille planen. Prøv igjen."));
		} finally {
			setSaving(false);
		}
	};

	const waitingText = waiting === 1 ? "1 søknad venter" : `${waiting} søknader venter`;
	return (
		<>
			<AlertDialog open={open} onOpenChange={setOpen}>
				{/* Kept mounted once finished, so the result below stays open. */}
				{!finalized && (
					<AlertDialogTrigger asChild>
						<Button variant={waiting > 0 ? "outline" : "default"}>
							Ferdigstill plan
							{waiting > 0 && ` (${waiting} venter)`}
						</Button>
					</AlertDialogTrigger>
				)}
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Ferdigstille planen for{" "}
							{semesterName(semester.term, semester.year, { inSentence: true })}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							{waiting > 0
								? `${waitingText} fortsatt på tilbud eller svar. Planen kan ferdigstilles når alle er avklart.`
								: "Hver bekreftet søknad får et upublisert arrangement på sin dato. Mangler den kontaktperson eller medhjelpere fra Navet, foreslås de."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={saving}>Avbryt</AlertDialogCancel>
						<Button disabled={saving} onClick={finalize}>
							Ferdigstill plan
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<FinalizeResultDialog result={result} onClose={() => setResult(null)} />
		</>
	);
}

function createdText(created: number): string {
	if (created === 0) return "Ingen nye arrangementer trengtes.";
	if (created === 1) return "1 upublisert arrangement er laget.";
	return `${created} upubliserte arrangementer er laget.`;
}

/** How many draft events the plan made, and the companies that need a profile in Bifrost first. */
function FinalizeResultDialog({
	result,
	onClose,
}: Readonly<{ result: FinalizeResult | null; onClose: () => void }>) {
	const created = result?.created ?? 0;
	const missing = result?.missingProfile ?? [];

	return (
		<Dialog open={result !== null} onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Planen er ferdigstilt</DialogTitle>
					<DialogDescription>
						{createdText(created)} Du finner dem under{" "}
						<Link href="/events" className="underline underline-offset-3">
							Arrangementer
						</Link>
						.
					</DialogDescription>
				</DialogHeader>

				{missing.length > 0 && (
					<Note tone="warn">
						<p className="font-medium">
							{missing.length === 1
								? "Denne bedriften har ingen profil i Bifrost, så arrangementet er ikke laget:"
								: "Disse bedriftene har ingen profil i Bifrost, så arrangementene er ikke laget:"}
						</p>
						<ul className="mt-1.5 list-disc pl-5">
							{missing.map((name) => (
								<li key={name}>{name}</li>
							))}
						</ul>
						<p className="mt-1.5">Opprett profilen, og så arrangementet fra søknaden.</p>
					</Note>
				)}

				<DialogFooter>
					{missing.length > 0 && (
						<Button asChild variant="outline">
							<Link href="/companies/create-company">
								<Plus aria-hidden /> Opprett bedrift
							</Link>
						</Button>
					)}
					<Button onClick={onClose}>Lukk</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** «Angre ferdigstilling»: marks the plan as not finished, so it can be changed and finished again. */
export function UnfinalizePlanButton({ semester }: Readonly<{ semester: Doc<"semesters"> }>) {
	const unfinalizePlan = useMutation(api.semesterPlanning.semesters.mutations.unfinalizePlan);
	const [saving, setSaving] = useState(false);

	const unfinalize = async () => {
		setSaving(true);
		try {
			await unfinalizePlan({ semesterId: semester._id });
			toast.success("Planen er ikke lenger ferdigstilt.");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke angre ferdigstillingen. Prøv igjen."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Button size="sm" variant="outline" disabled={saving} onClick={unfinalize}>
			Angre ferdigstilling
		</Button>
	);
}
