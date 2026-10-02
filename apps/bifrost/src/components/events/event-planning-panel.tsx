"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { DELIVERY_LABELS, planningCapacityLimit } from "@workspace/shared/events/planning";
import { EVENT_TYPE_LABELS, type EventType } from "@workspace/shared/semester/labels";
import { formatOsloDate, osloDateTimeToEpoch } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { EventPlanningForm } from "@workspace/ui/components/event-planning-form";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { SafeHtml } from "@workspace/ui/components/safe-html";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FoodItemSelect } from "./food/food-item-select";

type PlanningData = FunctionReturnType<typeof api.events.planning.admin.get>;
type Mode = "prepare" | "preview" | "review" | "delivery";
const titles: Record<Mode, string> = {
	prepare: "Klargjør første kontakt",
	preview: "Se over invitasjonen",
	review: "Gjennomgå bedriftens svar",
	delivery: "Levering og oppfølging",
};

export function EventPlanningPanel({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const data = useQuery(api.events.planning.admin.get, { eventId });
	const params = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const value = params.get("planning");
	const mode = value && value in titles ? (value as Mode) : null;
	function open(next: Mode | null) {
		const search = new URLSearchParams(params);
		if (next) search.set("planning", next);
		else search.delete("planning");
		router.replace(`${pathname}${search.size ? `?${search}` : ""}`, { scroll: false });
	}
	if (!data) return null;
	const ready = data.submission?.status === "ready";
	const errors = [
		data.planning?.error,
		...data.emails.filter((e) => e.error && !e.resolvedAt).map((e) => e.error),
		...data.slackErrors,
	].filter(Boolean);
	const status = data.planning?.status;
	return (
		<>
			<Card className="mb-6 max-w-3xl">
				<CardHeader>
					<CardTitle>
						{ready ? "Bedriften har sendt inn svar" : "Planlegging med bedriften"}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">
						{ready
							? "Kontroller innholdet og det praktiske før du godkjenner og publiserer. Nettsiden er ikke endret ennå."
							: data.awaitingConfirmation
								? "Bedriften har sendt inn opplysninger. Vi venter på e-postbekreftelsen før gjennomgang."
								: data.submission?.status === "approved"
									? "Bedriftens svar er godkjent og publisert. Nye svar blir sendt til gjennomgang igjen."
									: status === "invited"
										? "Invitasjonen er klargjort for sending. Følg levering og bedriftens svar her."
										: status === "manual"
											? "Første kontakt er fulgt opp manuelt."
											: "Kontroller kontaktperson og forhåndsutfylte opplysninger. E-post sendes først når du har sett over og trykket Send."}
					</p>
					{errors.length > 0 && (
						<div
							role="alert"
							className="rounded-md border border-destructive p-3 text-destructive text-sm"
						>
							<p className="font-semibold">Oppfølging nødvendig</p>
							<ul className="list-inside list-disc">
								{[...new Set(errors)].map((error) => (
									<li key={error}>{error}</li>
								))}
							</ul>
						</div>
					)}
					<div className="flex flex-wrap gap-2">
						{ready && <Button onClick={() => open("review")}>Gjennomgå og publiser</Button>}
						{(!status || status === "preparing") && (
							<Button onClick={() => open("prepare")}>Klargjør første kontakt</Button>
						)}
						<Button variant="outline" onClick={() => open("delivery")}>
							Levering og oppfølging
						</Button>
					</div>
				</CardContent>
			</Card>
			<Dialog
				open={!!mode}
				onOpenChange={(isOpen) => {
					if (!isOpen) open(null);
				}}
			>
				<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>{mode ? titles[mode] : "Planlegging"}</DialogTitle>
						<DialogDescription>
							{data.company.companyName} · {formatOsloDate(data.event.eventStart, "d. MMMM yyyy")}
						</DialogDescription>
					</DialogHeader>
					{mode === "prepare" && (
						<Preparation
							key={data.planning?.revision ?? 0}
							data={data}
							onSaved={() => open("preview")}
						/>
					)}
					{mode === "preview" && <Invitation data={data} open={open} />}
					{mode === "review" && (
						<Review key={data.submission?._id} data={data} onDone={() => open(null)} />
					)}
					{mode === "delivery" && <Delivery data={data} open={open} />}
				</DialogContent>
			</Dialog>
		</>
	);
}

function Preparation({ data, onSaved }: Readonly<{ data: PlanningData; onSaved: () => void }>) {
	const save = useMutation(api.events.planning.admin.savePreparation);
	const [contactName, setName] = useState(data.initial.contactName);
	const [contactEmail, setEmail] = useState(data.initial.contactEmail);
	const [signature, setSignature] = useState(data.initial.signature);
	const [eventType, setType] = useState<EventType | undefined>(data.initial.eventType);
	return (
		<EventPlanningForm
			initial={data.initial.answers}
			capacityLimit={
				eventType
					? Math.min(
							planningCapacityLimit(eventType),
							eventType === data.initial.eventType ? data.capacityLimit : 1000,
						)
					: 1000
			}
			submitLabel="Lagre og se over e-posten"
			onSubmit={async (answers) => {
				await save({
					eventId: data.event._id,
					revision: data.planning?.revision ?? 0,
					contactName,
					contactEmail,
					signature,
					eventType,
					answers,
				});
				onSaved();
			}}
			before={
				<div className="space-y-5">
					{data.previousReport && (
						<a
							className="text-sm underline"
							href={data.previousReport}
							target="_blank"
							rel="noreferrer"
						>
							Les rapporten fra forrige arrangement
						</a>
					)}
					<p className="text-muted-foreground text-sm">
						Opplysningene nedenfor fyller ut bedriftens skjema. Fyll inn kontaktperson selv hvis
						arrangementet ikke har en bestilling.
					</p>
					<Field>
						<FieldLabel htmlFor="planning-contact-name">Bedriftens kontaktperson</FieldLabel>
						<Input
							id="planning-contact-name"
							value={contactName}
							maxLength={150}
							onChange={(e) => setName(e.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="planning-contact-email">Kontaktpersonens e-post</FieldLabel>
						<Input
							id="planning-contact-email"
							type="email"
							value={contactEmail}
							maxLength={254}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="planning-package">Avtalt arrangementstype</FieldLabel>
						<select
							id="planning-package"
							className="h-10 rounded-md border bg-background px-3"
							value={eventType ?? ""}
							onChange={(e) => setType(e.target.value ? (e.target.value as EventType) : undefined)}
						>
							<option value="">Velg arrangementstype</option>
							{Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</Field>
					<Field>
						<FieldLabel htmlFor="planning-signature">Arrangørens signatur</FieldLabel>
						<Textarea
							id="planning-signature"
							rows={4}
							maxLength={2000}
							value={signature}
							onChange={(e) => setSignature(e.target.value)}
						/>
					</Field>
				</div>
			}
		/>
	);
}

function ActionButton({
	action,
	children,
	disabled = false,
}: Readonly<{ action: () => Promise<unknown>; children: React.ReactNode; disabled?: boolean }>) {
	const [pending, setPending] = useState(false);
	return (
		<Button
			disabled={disabled || pending}
			onClick={async () => {
				setPending(true);
				try {
					await action();
				} catch (error) {
					toast.error(convexErrorMessage(error, "Handlingen feilet. Prøv igjen."));
				} finally {
					setPending(false);
				}
			}}
		>
			{pending ? "Arbeider …" : children}
		</Button>
	);
}

function Invitation({
	data,
	open,
}: Readonly<{ data: PlanningData; open: (mode: Mode | null) => void }>) {
	const send = useMutation(api.events.planning.admin.send);
	if (!data.preview || !data.planning) return <p>Lagre opplysningene før du sender.</p>;
	const { envelope, blockers, fingerprint } = data.preview;
	const revision = data.planning.revision;
	return (
		<div className="space-y-5">
			<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
				{[
					["Fra", envelope.from],
					["Til", envelope.to],
					["Kopi", envelope.cc.join(", ")],
					["Svar til", envelope.replyTo.join(", ")],
					["Emne", envelope.subject],
				].map(([label, value]) => (
					<div key={label} className="contents">
						<dt className="font-medium">{label}</dt>
						<dd className="break-words">{value || "Mangler"}</dd>
					</div>
				))}
			</dl>
			<div className="rounded-lg border p-5">
				<p className="whitespace-pre-line text-sm leading-relaxed">{envelope.text}</p>
				<div className="mt-5 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground">
					Planlegg arrangementet
				</div>
			</div>
			<p className="text-muted-foreground text-sm">
				Knappen i e-posten åpner bedriftens private, forhåndsutfylte skjema.
			</p>
			{blockers.length > 0 && (
				<ul role="alert" className="list-inside list-disc text-destructive text-sm">
					{blockers.map((blocker) => (
						<li key={blocker}>{blocker}</li>
					))}
				</ul>
			)}
			<div className="flex flex-wrap gap-2">
				<Button variant="outline" onClick={() => open("prepare")}>
					Endre opplysninger
				</Button>
				<ActionButton
					disabled={blockers.length > 0 || data.planning.status === "invited"}
					action={async () => {
						await send({ eventId: data.event._id, revision, fingerprint });
						toast.success("Invitasjonen er lagt i sendekøen.");
						open("delivery");
					}}
				>
					Send invitasjon
				</ActionButton>
			</div>
		</div>
	);
}

function Review({ data, onDone }: Readonly<{ data: PlanningData; onDone: () => void }>) {
	const save = useMutation(api.events.planning.admin.saveReview);
	const approve = useMutation(api.events.planning.admin.approve);
	const [preview, setPreview] = useState(false);
	const [foodItem, setFoodItem] = useState(data.event.foodItem);
	const [registration, setRegistration] = useState(
		formatOsloDate(data.event.registrationOpens, "yyyy-MM-dd'T'HH:mm"),
	);
	const [acknowledged, setAcknowledged] = useState(false);
	const [expectedEvent] = useState(data.snapshot);
	const submission = data.submission;
	if (submission?.status !== "ready")
		return <p>Det finnes ingen svar som venter på godkjenning.</p>;
	const conflict = submission.baseEvent !== expectedEvent;
	return (
		<div className="space-y-5">
			<p className="text-muted-foreground text-sm">
				Bedriften har bekreftet svarene via e-post. Praktiske ønsker blir bevart her. Velg mat til
				nettsiden og kontroller påmeldingstid før publisering.
			</p>
			{conflict && (
				<details className="space-y-3 rounded-md border p-4" open>
					<summary className="cursor-pointer font-medium">
						Arrangementet er endret siden innsendingen. Se gjeldende innhold
					</summary>
					<h3 className="font-semibold">{data.event.title}</h3>
					<p>{data.event.teaser}</p>
					<SafeHtml html={data.event.description} className="prose prose-sm max-w-none" />
					<p className="text-sm">
						{data.event.location} · {formatOsloDate(data.event.eventStart, "d. MMM yyyy HH:mm")} ·{" "}
						{data.event.participationLimit} plasser · {data.event.language} ·{" "}
						{data.event.ageRestriction}
					</p>
				</details>
			)}
			{!preview ? (
				<EventPlanningForm
					key={submission.revision}
					initial={submission.draft}
					capacityLimit={data.capacityLimit}
					submitLabel="Lagre og forhåndsvis"
					onSubmit={async (answers) => {
						await save({ submissionId: submission._id, revision: submission.revision, answers });
						setPreview(true);
					}}
				/>
			) : (
				<>
					<article className="space-y-4 rounded-lg border p-5">
						<h2 className="font-bold text-2xl">{submission.draft.title}</h2>
						<p className="font-medium">{submission.draft.teaser}</p>
						<SafeHtml html={submission.draft.description} className="prose prose-sm max-w-none" />
						<p className="text-sm">
							{submission.draft.location} · {submission.draft.startTime} ·{" "}
							{submission.draft.capacity} plasser · {submission.draft.language} ·{" "}
							{submission.draft.ageRestriction === "18"
								? "18-årsgrense"
								: submission.draft.ageRestriction === "none"
									? "Ingen aldersgrense"
									: "Aldersgrense ikke avklart"}
						</p>
					</article>
					<Field>
						<FieldLabel htmlFor="planning-food-item">Mat på arrangementssiden</FieldLabel>
						<FoodItemSelect
							id="planning-food-item"
							value={foodItem}
							onChange={setFoodItem}
							allowCreate
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="planning-registration">Påmeldingen åpner (norsk tid)</FieldLabel>
						<Input
							id="planning-registration"
							type="datetime-local"
							value={registration}
							onChange={(e) => setRegistration(e.target.value)}
						/>
					</Field>
					{conflict && (
						<label className="flex items-start gap-3 rounded-md border p-3 text-sm">
							<input
								type="checkbox"
								checked={acknowledged}
								onChange={(e) => setAcknowledged(e.target.checked)}
								className="mt-1"
							/>
							Arrangementet er endret siden bedriften fylte ut skjemaet. Jeg har sammenlignet med
							arrangementet og bekrefter at dette utkastet skal publiseres.
						</label>
					)}
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" onClick={() => setPreview(false)}>
							Fortsett redigering
						</Button>
						<ActionButton
							disabled={!foodItem || !registration || (conflict && !acknowledged)}
							action={async () => {
								if (!foodItem) return;
								const [date, time] = registration.split("T");
								if (!date || !time) throw new Error("Velg dato og klokkeslett for påmeldingen.");
								const result = await approve({
									submissionId: submission._id,
									revision: submission.revision,
									expectedEvent,
									acknowledgeChanges: acknowledged,
									foodItem,
									registrationOpens: osloDateTimeToEpoch(date, time),
								});
								if (!result.ok) throw new Error(result.error);
								toast.success("Arrangementet er godkjent og publisert.");
								onDone();
							}}
						>
							Godkjenn og publiser
						</ActionButton>
					</div>
				</>
			)}
		</div>
	);
}

function Delivery({ data, open }: Readonly<{ data: PlanningData; open: (mode: Mode) => void }>) {
	const reopen = useMutation(api.events.planning.admin.reopen);
	const retry = useMutation(api.events.planning.admin.retryEmail);
	const resolve = useMutation(api.events.planning.admin.resolveEmail);
	const manual = useMutation(api.events.planning.admin.resolveManually);
	const [note, setNote] = useState("");
	return (
		<div className="space-y-6">
			{data.emails.length === 0 && (
				<p className="text-muted-foreground text-sm">Ingen e-post er sendt ennå.</p>
			)}
			{data.emails.map((email) => (
				<div key={email._id} className="space-y-2 rounded-lg border p-4 text-sm">
					<div className="flex flex-wrap justify-between gap-2">
						<strong>{email.kind === "invitation" ? "Invitasjon" : "E-postbekreftelse"}</strong>
						<span>{DELIVERY_LABELS[email.status]}</span>
					</div>
					<p className="break-all">{email.envelope.to}</p>
					<p className="text-muted-foreground">
						{formatOsloDate(email._creationTime, "d. MMM yyyy HH:mm")}
					</p>
					{email.error && !email.resolvedAt && (
						<p role="alert" className="text-destructive">
							{email.error}
						</p>
					)}
					{email.resolution && <p>Oppfølging: {email.resolution}</p>}
					{email.url && (
						<a href={email.url} target="_blank" rel="noreferrer" className="block underline">
							Åpne lokal forhåndsvisning
						</a>
					)}
					{!email.resolvedAt && email.kind === "invitation" && email.status === "failed" && (
						<ActionButton action={() => retry({ id: email._id })}>
							Prøv sending på nytt
						</ActionButton>
					)}
					{email.error && !email.resolvedAt && (
						<ActionButton disabled={!note.trim()} action={() => resolve({ id: email._id, note })}>
							Marker leveringsfeilen som fulgt opp
						</ActionButton>
					)}
				</div>
			))}
			<div className="space-y-3 border-t pt-5">
				<h3 className="font-semibold">Korrigering og manuell oppfølging</h3>
				<p className="text-muted-foreground text-sm">
					Klargjør en ny invitasjon for å endre mottaker. Den gamle skjemalenken slutter da å virke.
					Ved manuell oppfølging avsluttes den digitale forespørselen.
				</p>
				<ActionButton
					action={async () => {
						await reopen({ eventId: data.event._id });
						open("prepare");
					}}
				>
					Klargjør ny invitasjon
				</ActionButton>
				<Field>
					<FieldLabel htmlFor="planning-followup">Hva er fulgt opp?</FieldLabel>
					<Textarea
						id="planning-followup"
						value={note}
						maxLength={2000}
						onChange={(e) => setNote(e.target.value)}
						placeholder="Beskriv hva dere har gjort, og hva som er avtalt."
					/>
				</Field>
				<ActionButton
					disabled={!note.trim()}
					action={async () => {
						await manual({ eventId: data.event._id, note });
						toast.success("Manuell oppfølging er registrert.");
					}}
				>
					Avslutt med manuell oppfølging
				</ActionButton>
				{data.planning?.manualNote && (
					<p className="text-sm">Tidligere oppfølging: {data.planning.manualNote}</p>
				)}
			</div>
		</div>
	);
}
