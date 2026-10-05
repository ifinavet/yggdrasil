"use client";
import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Callout } from "@workspace/ui/components/products/callout";
import { useMutation } from "convex/react";
import { useState } from "react";

const jobLabels: Record<Doc<"admissionOutbox">["kind"], string> = {
	publish: "Intervjuinvitasjon",
	send_decision: "Svar på søknad",
	cancel_interview: "Avlysning",
	offer_declined: "Avslått tilbud",
	archive_channel: "Arkivering av Slack-kanal",
	sync_channel: "Synkronisering av Slack-medlemmer",
	remind_3d: "Påminnelse før intervju",
	remind_1d: "Påminnelse dagen før",
	delivery_failure: "Varsel om mislykket e-post",
};

export function DeliveryStatus({
	jobs,
	truncated,
	closing,
}: Readonly<{
	jobs: Doc<"admissionOutbox">[];
	truncated: boolean;
	closing: boolean;
}>) {
	const retry = useMutation(api.admissions.recovery.retryOutbox);
	const [retrying, setRetrying] = useState<string | null>(null);
	const [error, setError] = useState("");
	const failures = jobs.filter((job) => job.state === "failed");
	const active = jobs.filter(
		(job) =>
			job.state === "running" || (job.state === "pending" && job.nextAttemptAt <= Date.now()),
	);
	async function retryJob(idempotencyKey: string) {
		setRetrying(idempotencyKey);
		setError("");
		try {
			await retry({ idempotencyKey });
		} catch (cause) {
			setError(convexErrorMessage(cause, "Kunne ikke prøve på nytt."));
		} finally {
			setRetrying(null);
		}
	}
	return (
		<>
			{error && (
				<div role="alert">
					<Callout tone="danger">{error}</Callout>
				</div>
			)}
			{closing && (
				<Callout>
					Opptaket avsluttes. Kalenderavtaler ryddes, Slack-kanalen arkiveres og søknadsdata
					slettes.
				</Callout>
			)}
			{!closing && active.length > 0 && <Callout>{active.length} utsendinger behandles.</Callout>}
			{failures.map((job) => (
				<Callout
					key={job._id}
					tone="danger"
					action={
						<Button
							variant="outline"
							disabled={retrying !== null || Boolean(job.workflowId)}
							onClick={() => void retryJob(job.idempotencyKey)}
						>
							{job.workflowId ? "Prøver automatisk igjen" : "Prøv igjen"}
						</Button>
					}
				>
					<strong>{jobLabels[job.kind]}</strong>
					<p>{job.lastError ?? "Handlingen feilet. Prøv igjen eller følg opp manuelt."}</p>
				</Callout>
			))}
			{truncated && (
				<Callout tone="warning">
					Det er flere ventende handlinger enn det som vises her. Listen oppdateres etter hvert som
					de behandles.
				</Callout>
			)}
		</>
	);
}
