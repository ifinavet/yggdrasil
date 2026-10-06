"use client";
import { api } from "@workspace/backend/convex/api";
import type { FunctionReturnType } from "convex/server";

type Job = NonNullable<
	FunctionReturnType<typeof api.admissions.queries.adminOverview>
>["jobs"][number];

import { Button } from "@workspace/ui/components/button";
import { Callout } from "@workspace/ui/components/products/callout";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation } from "convex/react";

const jobLabels: Record<Job["kind"], string> = {
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
	closing,
}: Readonly<{
	jobs: Job[];
	closing: boolean;
}>) {
	const retry = useMutation(api.admissions.delivery.workflow.retry);
	const { pending: retrying, error, run } = useAsyncAction();
	const failures = jobs.filter((job) => job.state === "failed");
	const active = jobs.filter((job) => job.state === "inProgress" && job.dueAt <= Date.now());

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
							disabled={retrying}
							onClick={() =>
								void run(
									() => retry({ idempotencyKey: job.idempotencyKey }),
									undefined,
									"Kunne ikke prøve på nytt.",
								)
							}
						>
							Prøv igjen
						</Button>
					}
				>
					<strong>{jobLabels[job.kind]}</strong>
					<p>{job.lastError ?? "Handlingen feilet. Prøv igjen eller følg opp manuelt."}</p>
				</Callout>
			))}
		</>
	);
}
