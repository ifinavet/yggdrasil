"use client";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation } from "convex/react";

export function CancelInterviewDialog({
	candidate,
	onClose,
}: Readonly<{
	candidate: { _id: Id<"admissionApplications">; revision: number; name: string };
	onClose: () => void;
}>) {
	const cancel = useMutation(api.admissions.mutations.cancelInterviewByBoard);
	const { error, run } = useAsyncAction();
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
			onConfirm={() =>
				run(
					() =>
						cancel({
							applicationId: candidate._id,
							expectedRevision: candidate.revision,
							idempotencyKey: `cancel-${candidate._id}-${candidate.revision}`,
						}),
					undefined,
					"Kunne ikke avlyse intervjuet.",
				)
			}
		/>
	);
}
