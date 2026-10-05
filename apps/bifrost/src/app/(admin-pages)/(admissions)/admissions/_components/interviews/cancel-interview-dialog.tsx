"use client";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { useMutation } from "convex/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

export function CancelInterviewDialog({
	candidate,
	onClose,
}: Readonly<{
	candidate: { _id: Id<"admissionApplications">; revision: number; name: string };
	onClose: () => void;
}>) {
	const cancel = useMutation(api.admissions.mutations.cancelInterviewByBoard);
	const [error, setError] = useState("");
	async function confirm() {
		setError("");
		try {
			await cancel({
				applicationId: candidate._id,
				expectedRevision: candidate.revision,
				idempotencyKey: `cancel-${candidate._id}-${candidate.revision}`,
			});
			return true;
		} catch (cause) {
			setError(convexErrorMessage(cause, "Kunne ikke avlyse intervjuet."));
			return false;
		}
	}
	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title="Avlyse intervjuet?"
			description={`Intervjuet med ${candidate.name} avlyses. En allerede sendt invitasjon følges opp med e-post til søkeren.`}
			confirmLabel="Bekreft avlysning"
			destructive
			error={error}
			onConfirm={confirm}
		/>
	);
}
