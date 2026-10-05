"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation } from "convex/react";
import { useState } from "react";

export function CloseDialog({
	open,
	onOpenChange,
	periodId,
	counts,
	onClosed,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	periodId: Id<"admissionPeriods">;
	counts: { pendingOffers: number; futureInterviews: number; unsentDecisions: number };
	onClosed: () => void;
}>) {
	const close = useMutation(api.admissions.mutations.closePeriod);
	const [confirmed, setConfirmed] = useState(false);
	const { error, run } = useAsyncAction();
	const forceRequired = Object.values(counts).some((count) => count > 0);
	const canClose = !forceRequired || confirmed;

	function submit() {
		if (!canClose) return Promise.resolve(false);
		return run(
			() => close({ periodId, force: forceRequired }),
			onClosed,
			"Opptaket kunne ikke avsluttes.",
		);
	}

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={(nextOpen) => {
				onOpenChange(nextOpen);
				if (!nextOpen) setConfirmed(false);
			}}
			title="Avslutte opptaket?"
			description="Opptaksdataene slettes når opptaket avsluttes."
			confirmLabel="Bekreft avslutning"
			cancelLabel="Behold opptaket"
			destructive
			disabled={!canClose}
			error={error}
			onConfirm={submit}
		>
			<ul className="grid gap-2 text-sm">
				<li>{counts.pendingOffers} ventende tilbud</li>
				<li>{counts.futureInterviews} kommende intervju</li>
				<li>{counts.unsentDecisions} usendte beslutninger</li>
			</ul>
			{forceRequired && (
				<div className="flex items-start gap-3 text-sm">
					<Checkbox
						aria-label="Jeg vil avslutte opptaket nå selv om dette ikke er avklart"
						checked={confirmed}
						onCheckedChange={(checked) => setConfirmed(checked === true)}
					/>
					<span>Jeg vil avslutte opptaket nå selv om dette ikke er avklart.</span>
				</div>
			)}
		</ConfirmDialog>
	);
}
