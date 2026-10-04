"use client";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Callout } from "@workspace/ui/components/products/callout";
import { useMutation } from "convex/react";
import { useState } from "react";

export function CancelInterviewDialog({
	candidate,
	onClose,
}: Readonly<{
	candidate: { _id: Id<"admissionApplications">; revision: number; name: string };
	onClose: () => void;
}>) {
	const cancel = useMutation(api.admissions.mutations.cancelInterviewByBoard);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	async function confirm() {
		setPending(true);
		setError("");
		try {
			await cancel({
				applicationId: candidate._id,
				expectedRevision: candidate.revision,
				idempotencyKey: `cancel-${candidate._id}-${candidate.revision}`,
			});
			onClose();
		} catch (cause) {
			setError(convexErrorMessage(cause, "Kunne ikke avlyse intervjuet."));
		} finally {
			setPending(false);
		}
	}
	return (
		<AlertDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Avlyse intervjuet?</AlertDialogTitle>
					<AlertDialogDescription>
						Intervjuet med {candidate.name} avlyses. En allerede sendt invitasjon følges opp med
						e-post til søkeren.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error && (
					<div role="alert">
						<Callout tone="danger">{error}</Callout>
					</div>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>Tilbake</AlertDialogCancel>
					<Button variant="destructive" disabled={pending} onClick={() => void confirm()}>
						Bekreft avlysning
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
