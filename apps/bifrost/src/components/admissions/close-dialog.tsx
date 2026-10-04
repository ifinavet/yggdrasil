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
import { Checkbox } from "@workspace/ui/components/checkbox";
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
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const forceRequired = Object.values(counts).some((count) => count > 0);
	const canClose = !forceRequired || confirmed;

	async function submit() {
		if (!canClose || busy) return;
		setBusy(true);
		setError("");
		try {
			await close({
				periodId,
				idempotencyKey: `close-${periodId}`,
				force: forceRequired,
			});
			onOpenChange(false);
			onClosed();
		} catch (cause) {
			setError(convexErrorMessage(cause, "Opptaket kunne ikke avsluttes."));
		} finally {
			setBusy(false);
		}
	}

	return (
		<AlertDialog
			open={open}
			onOpenChange={(nextOpen) => {
				onOpenChange(nextOpen);
				if (!nextOpen) setConfirmed(false);
			}}
		>
			<AlertDialogContent aria-describedby="close-admissions-description">
				<AlertDialogHeader>
					<AlertDialogTitle>Avslutte opptaket?</AlertDialogTitle>
					<AlertDialogDescription id="close-admissions-description">
						Opptaksdataene slettes når opptaket avsluttes.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<ul className="grid gap-2 text-sm">
					<Count label="ventende tilbud" count={counts.pendingOffers} />
					<Count label="kommende intervju" count={counts.futureInterviews} />
					<Count label="usendte beslutninger" count={counts.unsentDecisions} />
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
				{error && (
					<p role="alert" className="text-destructive">
						{error}
					</p>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>Behold opptaket</AlertDialogCancel>
					<Button variant="destructive" disabled={!canClose || busy} onClick={() => void submit()}>
						Bekreft avslutning
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function Count({ label, count }: Readonly<{ label: string; count: number }>) {
	return (
		<li>
			{count} {label}
		</li>
	);
}
