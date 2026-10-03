"use client";
import { api } from "@workspace/backend/convex/api";
import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants";
import type { PlanningAnswers } from "@workspace/shared/events/planning";
import type { EventType } from "@workspace/shared/semester/labels";
import { EVENT_SEMESTER_LABELS, eventSemesterOf, formatSemesterDay } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { EventPlanningForm } from "@workspace/ui/components/event-planning-form";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { EmailCheckScreen } from "@/components/email-check-screen";
import { FormStatePanel } from "@/components/form-state-panel";
import { useEmailLinkToken } from "@/lib/use-email-link-token";

export function CompanyPlanning() {
	const token = useEmailLinkToken();
	if (token === undefined) return <output>Henter arrangementet …</output>;
	if (!token) return <Unavailable />;
	return <Planning key={token} token={token} />;
}
function Planning({ token }: Readonly<{ token: string }>) {
	const [now] = useState(Date.now);
	const data = useQuery(api.events.planning.public.get, { token, now });
	const resend = useMutation(api.events.planning.public.resend);
	const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
	const [sent, setSent] = useState(false);
	const [lastAnswers, setLastAnswers] = useState<PlanningAnswers>();
	if (data === undefined) return <output>Henter arrangementet …</output>;
	if (!data) return <Unavailable />;
	const { semester, year } = eventSemesterOf(data.eventStart);
	const organizerEmail = data.organizerEmail || COMPANY_CONTACT_EMAIL;
	const contact = (
		<p className="text-muted-foreground text-sm">
			Spørsmål?{" "}
			<a className="break-words underline underline-offset-4" href={`mailto:${organizerEmail}`}>
				Kontakt {organizerEmail}
			</a>
		</p>
	);
	return (
		<div className="mx-auto w-full max-w-[65ch] py-5 sm:py-8">
			<header className="mb-8 space-y-5">
				<div className="flex items-center gap-4">
					<CompanyLogo name={data.companyName} url={data.logoUrl} size="xl" />
					<p className="min-w-0 break-words font-semibold text-xl">{data.companyName}</p>
				</div>
				{!sent && <h1 className="font-bold text-3xl">Planlegg bedriftspresentasjon</h1>}
				<div className="flex flex-wrap gap-3">
					<div className="rounded-lg bg-blue-50 px-4 py-3 text-blue-950 dark:bg-blue-950 dark:text-blue-100">
						<p className="font-semibold">
							<time dateTime={data.eventDate}>{formatSemesterDay(data.eventDate, "long")}</time>
						</p>
					</div>
					<div className="rounded-lg bg-blue-50 px-4 py-3 text-blue-950 dark:bg-blue-950 dark:text-blue-100">
						<p className="font-semibold">
							{EVENT_SEMESTER_LABELS[semester]} {year}
						</p>
					</div>
				</div>
				{contact}
				{!sent && (
					<p className="rounded-lg bg-muted p-4 text-base text-foreground leading-7">
						Send inn det dere vet nå. Etter at dere har bekreftet via e-post, kan dere bruke samme
						lenke for å endre og utfylle svarene senere.
					</p>
				)}
			</header>
			{sent ? (
				<>
					<EmailCheckScreen
						email={data.contactEmail}
						body={`Vi har sendt en lenke til ${data.contactEmail}. Bekreft e-posten for å sende opplysningene til Navet.`}
						onResend={() => resend({ token, submissionId })}
					/>
					<Button
						variant="ghost"
						onClick={() => {
							setSent(false);
							setSubmissionId(crypto.randomUUID());
						}}
					>
						Tilbake til skjemaet
					</Button>
				</>
			) : (
				<CompanyAnswers
					token={token}
					submissionId={submissionId}
					revision={data.revision}
					initial={lastAnswers ?? data.answers}
					capacityLimit={data.capacityLimit}
					eventType={data.eventType}
					onSent={(answers) => {
						setLastAnswers(answers);
						setSent(true);
					}}
				/>
			)}
			{data.organizers.length > 0 && (
				<section className="mt-12 space-y-5" aria-labelledby="organizers-heading">
					<h2 id="organizers-heading" className="font-semibold text-lg">
						Kontaktpersoner fra Navet
					</h2>
					<ul className="grid gap-6 sm:grid-cols-2">
						{[...data.organizers]
							.sort(
								(a, b) => Number(b.role === "hovedansvarlig") - Number(a.role === "hovedansvarlig"),
							)
							.map((organizer) => (
								<li key={`${organizer.role}-${organizer.email}`} className="min-w-0 space-y-1">
									<p className="text-muted-foreground text-sm">
										{organizer.role === "hovedansvarlig" ? "Hovedansvarlig" : "Medhjelper"}
									</p>
									<p className="font-semibold">{organizer.name}</p>
									{organizer.email && (
										<a
											className="break-words text-sm underline underline-offset-4"
											href={`mailto:${organizer.email}`}
										>
											{organizer.email}
										</a>
									)}
								</li>
							))}
					</ul>
				</section>
			)}
			<div className="mt-8">{contact}</div>
		</div>
	);
}
function CompanyAnswers({
	token,
	submissionId,
	revision,
	initial,
	capacityLimit,
	eventType,
	onSent,
}: Readonly<{
	token: string;
	submissionId: string;
	revision: number;
	initial: PlanningAnswers;
	capacityLimit: number;
	eventType?: EventType;
	onSent: (answers: PlanningAnswers) => void;
}>) {
	const searchAddresses = useAction(api.jobListingOrders.addressSearch.searchAddresses);
	const submit = useMutation(api.events.planning.public.submit);
	const [openedRevision] = useState(revision);
	return (
		<EventPlanningForm
			searchAddresses={searchAddresses}
			initial={initial}
			capacityLimit={capacityLimit}
			eventType={eventType}
			onSubmit={async (answers) => {
				await submit({ token, submissionId, revision: openedRevision, answers });
				onSent(answers);
			}}
		/>
	);
}
function Unavailable() {
	return (
		<FormStatePanel
			title="Lenken er ikke tilgjengelig"
			body="Arrangementet kan være avsluttet, eller lenken kan være erstattet. Kontakt Navet for hjelp."
			action={
				<a className="underline" href={`mailto:${COMPANY_CONTACT_EMAIL}`}>
					Kontakt Navet
				</a>
			}
		/>
	);
}
export function ConfirmPlanning() {
	const token = useEmailLinkToken();
	const confirm = useMutation(api.events.planning.public.confirm);
	const [state, setState] = useState("idle");
	if (token === undefined) return null;
	if (!token) return <Unavailable />;
	if (state === "confirmed")
		return (
			<FormStatePanel
				action={null}
				title="Takk, opplysningene er bekreftet!"
				body="Bruk lenken i invitasjonen for å endre svarene senere."
			/>
		);
	if (state === "invalid" || state === "expired")
		return (
			<FormStatePanel
				action={null}
				title={state === "expired" ? "Lenken har utløpt" : "Lenken er ikke gyldig lenger"}
				body="Åpne skjemaet fra invitasjonen igjen. Send inn svarene, eller be om en ny bekreftelseslenke."
			/>
		);
	return (
		<FormStatePanel
			title="Bekreft opplysningene"
			body="Klikk nedenfor for å bekrefte opplysningene dere sendte inn til Navet."
			action={
				<Button
					size="lg"
					disabled={state === "pending"}
					onClick={async () => {
						setState("pending");
						try {
							setState((await confirm({ token })).state);
						} catch {
							setState("error");
						}
					}}
				>
					{state === "pending" ? "Bekrefter …" : "Bekreft opplysningene"}
				</Button>
			}
			quiet={
				state === "error" ? <p role="alert">Kunne ikke bekrefte nå. Prøv igjen.</p> : undefined
			}
		/>
	);
}
