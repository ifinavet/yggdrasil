"use client";

import { api } from "@workspace/backend/convex/api";
import { roomUrl } from "@workspace/shared/admissions";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import {
	AlertDialog,
	AlertDialogAction,
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
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	async function perform(action: () => Promise<void>, fallback: string) {
		if (busy) return;
		setBusy(true);
		setMessage("");
		try {
			await action();
		} catch (error) {
			setMessage(convexErrorMessage(error, fallback));
		} finally {
			setBusy(false);
		}
	}

	async function onReopen() {
		if (application)
			await perform(async () => {
				await reopen({ periodId: period._id, expectedRevision: application.revision });
			}, "Søknaden kunne ikke åpnes for endring.");
	}

	async function onCancelInterview() {
		if (application)
			await perform(async () => {
				await cancelInterview({
					applicationId: application._id,
					expectedRevision: application.revision,
					idempotencyKey: crypto.randomUUID(),
				});
			}, "Intervjuet kunne ikke avlyses. Prøv igjen.");
	}

	async function onReply(accept: boolean) {
		if (application)
			await perform(async () => {
				const result = await respondToOffer({
					periodId: period._id,
					accept,
					expectedRevision: application.revision,
				});
				const confirmation = accept ? "Du har takket ja til plassen" : "Takk for at du ga beskjed";
				setMessage(
					result.offerStatus === "expired" ? "Svarfristen for tilbudet har gått ut." : confirmation,
				);
			}, "Svaret ditt kunne ikke lagres. Prøv igjen.");
	}

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
					<OfferConfirmation accept onConfirm={() => void onReply(true)} />
					<OfferConfirmation accept={false} onConfirm={() => void onReply(false)} />
				</div>
				{message && <output>{message}</output>}
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
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="outline">Avlys intervjuet</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Avlyse intervjuet?</AlertDialogTitle>
							<AlertDialogDescription>
								Intervjutiden blir avlyst når du bekrefter.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Behold intervjuet</AlertDialogCancel>
							<AlertDialogAction onClick={() => void onCancelInterview()}>
								Ja, avlys intervjuet
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				{message && <output>{message}</output>}
			</ApplicationNotice>
		);
	if (application.interviewStatus === "cancelled")
		return (
			<ApplicationNotice title="Intervjuet er avlyst">
				<p>Vi har registrert at du har avlyst intervjuet.</p>
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
			{message && <output>{message}</output>}
		</ApplicationNotice>
	);
}

function OfferConfirmation({
	accept,
	onConfirm,
}: Readonly<{ accept: boolean; onConfirm: () => void }>) {
	const verb = accept ? "ja" : "nei";
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant={accept ? "default" : "outline"}>{`Takk ${verb}`}</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{`Takke ${verb} til plassen?`}</AlertDialogTitle>
					<AlertDialogDescription>
						{accept
							? "Når du bekrefter, registrerer vi at du takker ja."
							: "Når du bekrefter, registrerer vi at du takker nei."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Tilbake</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
					>{`Bekreft at jeg takker ${verb}`}</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
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
