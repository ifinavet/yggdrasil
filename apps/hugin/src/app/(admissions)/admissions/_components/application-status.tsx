"use client";

import { api } from "@workspace/backend/convex/api";
import { roomUrl } from "@workspace/shared/admissions";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation } from "convex/react";
import { Check } from "lucide-react";
import { useState } from "react";

import type { InitialApplication, Period } from "./application";
export function ApplicationStatus({
	application,
	period,
	applicationWindowClosed,
}: Readonly<{
	application: NonNullable<InitialApplication>;
	period: Period;
	applicationWindowClosed: boolean;
}>) {
	const reopen = useMutation(api.admissions.mutations.reopenApplication);
	const cancelInterview = useMutation(api.admissions.mutations.cancelInterview);
	const respondToOffer = useMutation(api.admissions.mutations.respondToOffer);
	const { pending: busy, error: message, run } = useAsyncAction();
	const [confirmation, setConfirmation] = useState<"cancel" | "accept" | "decline" | null>(null);

	function onReopen() {
		return run(
			() => reopen({ periodId: period._id, expectedRevision: application.revision }),
			undefined,
			"Søknaden kunne ikke åpnes for endring.",
		);
	}

	function onCancelInterview() {
		return run(
			() =>
				cancelInterview({
					applicationId: application._id,
					expectedRevision: application.revision,
					idempotencyKey: crypto.randomUUID(),
				}),
			undefined,
			"Intervjuet kunne ikke avlyses. Prøv igjen.",
		);
	}

	function onReply(accept: boolean) {
		return run(
			() =>
				respondToOffer({
					periodId: period._id,
					accept,
					expectedRevision: application.revision,
				}),
			undefined,
			"Svaret ditt kunne ikke lagres. Prøv igjen.",
		);
	}

	function renderStatus() {
		if (application.offerStatus === "expired")
			return (
				<ApplicationNotice title="Svarfristen er passert">
					<p>Fristen for å svare på tilbudet har gått ut. Tilbudet er ikke lenger tilgjengelig.</p>
				</ApplicationNotice>
			);
		if (application.offerStatus === "pending")
			return (
				<ApplicationNotice title="Du har fått tilbud om plass">
					<p>Gi beskjed om du takker ja eller nei til tilbudet.</p>
					{application.offerDeadline && (
						<p>Svarfrist: {formatOsloDate(application.offerDeadline, DATE_PATTERNS.dateTime)}.</p>
					)}
					<div className="flex flex-wrap gap-3">
						<Button disabled={busy} onClick={() => setConfirmation("accept")}>
							Takk ja
						</Button>
						<Button variant="outline" disabled={busy} onClick={() => setConfirmation("decline")}>
							Takk nei
						</Button>
					</div>
				</ApplicationNotice>
			);
		if (application.offerStatus === "accepted")
			return (
				<ApplicationNotice title="Du har takket ja til plassen">
					<p>Navet har mottatt svaret ditt.</p>
				</ApplicationNotice>
			);
		if (application.offerStatus === "declined")
			return (
				<ApplicationNotice title="Takk for at du ga beskjed">
					<p>Vi har mottatt svaret ditt.</p>
				</ApplicationNotice>
			);
		if (application.decisionSentAt && application.decision === "rejected")
			return (
				<ApplicationNotice title="Takk for at du søkte">
					<p>Opptaket er ferdig for denne gangen.</p>
				</ApplicationNotice>
			);
		if (application.interview)
			return (
				<ApplicationNotice title="Intervjuet ditt">
					<p>{formatOsloDate(application.interview.startAt, DATE_PATTERNS.dateTime)}</p>
					<p>
						Møterom:{" "}
						<a
							href={roomUrl(application.interview.room)}
							target="_blank"
							rel="noreferrer"
							className="text-primary underline underline-offset-4"
						>
							{application.interview.room}
						</a>
					</p>
					<Button variant="outline" disabled={busy} onClick={() => setConfirmation("cancel")}>
						Avlys intervjuet
					</Button>
				</ApplicationNotice>
			);
		if (application.interviewStatus === "cancelled")
			return (
				<ApplicationNotice title="Intervjuet er avlyst">
					<p>Intervjutiden din er avlyst.</p>
				</ApplicationNotice>
			);
		return (
			<ApplicationNotice title="Søknaden din er sendt">
				<p>Søknaden din er lagret.</p>
				{period.interviewStartAt > 0 && !applicationWindowClosed && !application.decisionSentAt && (
					<Button variant="outline" disabled={busy} onClick={() => void onReopen()}>
						Rediger søknaden
					</Button>
				)}
			</ApplicationNotice>
		);
	}
	const cancel = confirmation === "cancel";
	const verb = confirmation === "accept" ? "ja" : "nei";
	return (
		<>
			{renderStatus()}
			{message && confirmation === null && <p role="alert">{message}</p>}
			<ConfirmDialog
				open={confirmation !== null}
				onOpenChange={(open) => {
					if (!open) setConfirmation(null);
				}}
				title={cancel ? "Avlyse intervjuet?" : `Takke ${verb} til plassen?`}
				description={
					cancel
						? "Intervjutiden blir avlyst når du bekrefter."
						: `Når du bekrefter, registrerer vi at du takker ${verb}.`
				}
				confirmLabel={cancel ? "Ja, avlys intervjuet" : `Bekreft at jeg takker ${verb}`}
				cancelLabel={cancel ? "Behold intervjuet" : "Tilbake"}
				error={message}
				onConfirm={() => (cancel ? onCancelInterview() : onReply(confirmation === "accept"))}
			/>
		</>
	);
}

export function ApplicationNotice({
	title,
	children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
	return (
		<section className="mx-auto max-w-xl py-16">
			<Check className="mb-4 size-7 text-primary" aria-hidden />
			<h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
			<div className="mt-4 flex flex-col items-start gap-3 text-base leading-relaxed">
				{children}
			</div>
		</section>
	);
}
