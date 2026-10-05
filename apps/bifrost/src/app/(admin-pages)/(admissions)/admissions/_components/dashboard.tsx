"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { makeSchedulingDays } from "@workspace/shared/admissions";
import { Button } from "@workspace/ui/components/button";
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog";
import { Callout } from "@workspace/ui/components/products/callout";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";

import { useAction, useMutation, useQuery } from "convex/react";
import {
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Columns3,
	Mail,
	Maximize2,
	Plus,
	Settings2,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/common/tables/table";
import { CandidateDialog } from "./candidates/candidate-dialog";
import { CandidateFilters } from "./candidates/candidate-filters";
import { OfferDialog } from "./candidates/offer-dialog";
import { SelectionBoard } from "./candidates/selection-board";
import { DeliveryStatus } from "./delivery-status";
import { CalendarDialog } from "./interviews/calendar-dialog";
import { CancelInterviewDialog } from "./interviews/cancel-interview-dialog";
import { InterviewCalendar } from "./interviews/interview-calendar";
import { InterviewDialog } from "./interviews/interview-dialog";
import { type Candidate, type Decision, decisionLabels } from "./model";
import { SettingsDialog } from "./period/settings-dialog";

const offerLabels = {
	none: "",
	pending: "Venter på svar",
	accepted: "Takket ja",
	declined: "Takket nei",
	expired: "Svarfristen er ute",
};

export default function AdmissionsDashboard() {
	const overview = useQuery(api.admissions.queries.adminOverview, {});
	const setDecision = useMutation(api.admissions.mutations.setDecision);
	const addNote = useMutation(api.admissions.mutations.addNote);
	const assignRooms = useMutation(api.admissions.board.assignRooms);
	const changeRound = useMutation(api.admissions.board.changeRound);
	const sendDecision = useMutation(api.admissions.mutations.sendDecision);
	const publish = useMutation(api.admissions.mutations.publish);
	const generate = useAction(api.admissions.interviews.calendar.generateSchedule);
	const [view, setView] = useState<"calendar" | "candidates" | "selection">("calendar");
	const [selected, setSelected] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [program, setProgram] = useState("");
	const [year, setYear] = useState("");
	const [fullscreen, setFullscreen] = useState(false);
	const { pending: busy, error, run } = useAsyncAction();
	const [offerCandidate, setOfferCandidate] = useState<string | null>(null);
	const [confirmSend, setConfirmSend] = useState(false);
	const [configure, setConfigure] = useState(false);
	const [calendars, setCalendars] = useState(false);
	const [roomDraft, setRoomDraft] = useState("");
	const [manualInterview, setManualInterview] = useState(false);
	const [cancelInterview, setCancelInterview] = useState(false);

	const perform = (action: () => Promise<unknown>, message: string) =>
		run(action, () => toast.success(message), "Handlingen mislyktes. Prøv igjen.");
	if (overview === undefined) return <output>Laster opptaket…</output>;
	if (!overview)
		return (
			<section
				className={`admissions flex min-w-0 flex-col gap-6 pb-8 ${fullscreen ? "admissions-fullscreen fixed inset-0 z-40 overflow-auto bg-background p-4 md:px-8 md:py-6" : ""}`}
			>
				<h1>Opptak</h1>
				<div className="admissions-empty flex flex-col items-center gap-5 px-6 py-20">
					<Users size={36} />
					<h2>Ingen aktive opptak</h2>
					<Button onClick={() => setConfigure(true)}>
						<Plus />
						Start opptak
					</Button>
				</div>
				<SettingsDialog
					open={configure}
					onOpenChange={setConfigure}
					onSaved={() => toast.success("Opptaket er opprettet")}
				/>
			</section>
		);
	const { period } = overview;
	const { candidates, interviewers: team, interviews } = overview;
	const days = makeSchedulingDays(period.interviewStartAt, period.interviewEndAt, period.timezone);
	const current = overview.candidates.find((candidate) => candidate._id === selected);
	const interview = current?.interview;
	const pending = overview.candidates.filter(
		(entry) =>
			!entry.sent &&
			entry.decisionQueuedAt === undefined &&
			(entry.decision === "accepted" || entry.decision === "rejected"),
	);
	const filtered = candidates.filter(
		(entry) =>
			entry.name.toLocaleLowerCase("nb").includes(query.toLocaleLowerCase("nb")) &&
			(!program || entry.program === program) &&
			(!year || entry.year === Number(year)),
	);
	const openCandidate = (id: string) => {
		setSelected(id);
		setRoomDraft(overview.interviews.find((row) => row.applicationId === id)?.room ?? period.room);
	};
	const saveRooms = (ids: string[], room: string) =>
		perform(
			() =>
				assignRooms({
					periodId: period._id,
					expectedRevision: period.revision,
					applicationIds: ids as Id<"admissionApplications">[],
					room,
				}),
			"Romfordelingen er lagret",
		);
	const sendReply = (entry: Candidate) =>
		sendDecision({
			applicationId: entry._id,
			expectedRevision: entry.revision,
			idempotencyKey: `decision-${entry._id}-${entry.decisionRevision}`,
		});
	const decide = (id: string, decision: Decision) => {
		const row = overview.candidates.find((entry) => entry._id === id);
		if (!row) return;
		if (decision === "accepted") {
			setOfferCandidate(id);
			return;
		}
		void perform(
			() => setDecision({ applicationId: row._id, expectedRevision: row.revision, decision }),
			"Vedtaket er lagret",
		);
	};
	return (
		<section
			className={`admissions flex min-w-0 flex-col gap-6 pb-8 ${fullscreen ? "admissions-fullscreen fixed inset-0 z-40 overflow-auto bg-background p-4 md:px-8 md:py-6" : ""}`}
		>
			<div className="admissions-title flex flex-wrap items-center justify-between gap-4 [&_h1]:font-semibold [&_h1]:text-3xl [&_h1]:tracking-tight">
				<div>
					<h1>Opptak</h1>
					<p>{period.title}</p>
				</div>
				<div className="admissions-actions flex flex-wrap items-center gap-3">
					<Button
						variant="outline"
						aria-label={fullscreen ? "Avslutt storskjerm" : "Storskjerm"}
						onClick={() => setFullscreen(!fullscreen)}
					>
						{fullscreen ? <X /> : <Maximize2 />}
					</Button>
					<Button variant="outline" aria-label="Innstillinger" onClick={() => setConfigure(true)}>
						<Settings2 />
					</Button>
					<Button disabled={busy || !pending.length} onClick={() => setConfirmSend(true)}>
						<Mail />
						Send svar ({pending.length})
					</Button>
				</div>
			</div>
			{error && (
				<div role="alert">
					<Callout tone="danger">{error}</Callout>
				</div>
			)}
			{overview.deliveryIssues.map((delivery) => (
				<Callout key={delivery._id} tone="danger">
					{delivery.error}
				</Callout>
			))}
			{overview.candidates.some((row) => row.offerStatus === "declined") && (
				<Callout
					tone="warning"
					action={
						<Button variant="outline" onClick={() => setView("candidates")}>
							Velg ny kandidat
						</Button>
					}
				>
					{overview.candidates
						.filter((row) => row.offerStatus === "declined")
						.map((row) => row.name)
						.join(", ")}{" "}
					har takket nei.
				</Callout>
			)}
			<DeliveryStatus jobs={overview.jobs} closing={period.status === "closing"} />
			<nav
				className="admissions-tabs flex flex-wrap items-center gap-1"
				aria-label="Opptaksvisninger"
			>
				{(
					[
						["calendar", CalendarDays, "Intervjuer"],
						["candidates", Users, `Kandidater (${candidates.length})`],
						["selection", Columns3, "Utvelgelse"],
					] as const
				).map(([key, Icon, label]) => (
					<Button
						key={key}
						variant={view === key ? "secondary" : "ghost"}
						aria-pressed={view === key}
						onClick={() => setView(key)}
					>
						<Icon />
						{label}
					</Button>
				))}
			</nav>
			{view === "calendar" ? (
				<InterviewCalendar
					candidates={candidates}
					interviews={interviews}
					settings={period}
					days={days}
					team={team}
					approved={period.status === "published"}
					onOpenCandidate={openCandidate}
					onOpenCalendars={() => setCalendars(true)}
					onGenerateSchedule={() =>
						void perform(
							() => generate({ periodId: period._id, expectedRevision: period.revision }),
							"Nytt forslag er klart",
						)
					}
					onApprove={() =>
						perform(
							() =>
								publish({
									periodId: period._id,
									expectedRevision: period.revision,
									idempotencyKey: `publish-${period.revision}`,
								}),
							"Intervjuplanen er klar for utsending",
						)
					}
					onAssignRoom={saveRooms}
				/>
			) : (
				<>
					<div className="admissions-toolbar flex flex-wrap items-center justify-between gap-4">
						<CandidateFilters
							query={query}
							setQuery={setQuery}
							program={program}
							setProgram={setProgram}
							year={year}
							setYear={setYear}
						/>
						{view === "selection" && (
							<div className="admissions-actions flex flex-wrap items-center gap-3">
								<span>Runde {period.round + 1}</span>
								{(["previous", "next"] as const).map((direction) => (
									<Button
										key={direction}
										variant={direction === "previous" ? "outline" : "default"}
										disabled={
											busy ||
											(direction === "previous"
												? !period.roundHistory.length
												: !candidates.some((entry) => entry.decision === "shortlist"))
										}
										onClick={() =>
											void perform(
												() =>
													changeRound({
														periodId: period._id,
														expectedRevision: period.revision,
														direction,
													}),
												direction === "previous"
													? "Forrige runde er gjenopprettet"
													: "Neste runde er klar",
											)
										}
									>
										{direction === "previous" && <ChevronLeft />}
										{direction === "previous" ? "Forrige runde" : "Neste runde"}
										{direction === "next" && <ChevronRight />}
									</Button>
								))}
							</div>
						)}
					</div>
					{view === "selection" ? (
						<>
							<Callout>
								Dra kandidatene dere vil vurdere videre til «Videre». Ved neste runde flyttes resten
								til «Avslått». Dere kan hente dem tilbake. Ingen e-post sendes før dere velger «Send
								svar».
							</Callout>
							<SelectionBoard
								candidates={filtered}
								onSelect={openCandidate}
								onDecisionChange={decide}
							/>
						</>
					) : (
						<DataTable data={filtered} columns={candidateColumns(openCandidate)} />
					)}
				</>
			)}
			<CandidateDialog
				key={selected}
				candidate={current}
				interview={interview ?? undefined}
				settings={period}
				room={roomDraft}
				team={team}
				onClose={() => setSelected(null)}
				onRoomChange={setRoomDraft}
				onDecisionChange={(decision) => {
					if (selected) decide(selected, decision);
				}}
				onSaveNotes={async (notes) => {
					if (current)
						await perform(
							() =>
								addNote({
									applicationId: current._id,
									expectedRevision: current.revision,
									note: notes,
								}),
							"Notatene er lagret",
						);
				}}
				actions={
					current && (
						<div className="grid gap-3">
							{error && <Callout tone="danger">{error}</Callout>}
							{!interview && (
								<Button variant="outline" onClick={() => setManualInterview(true)}>
									Sett intervjutid
								</Button>
							)}
							{interview && (
								<Button variant="outline" onClick={() => setCancelInterview(true)}>
									Avlys intervju
								</Button>
							)}
							{interview && (
								<Button
									disabled={busy || !roomDraft.trim()}
									onClick={() => void saveRooms([current._id], roomDraft)}
								>
									Lagre rom
								</Button>
							)}
							{current.decision === "accepted" && !current.sent && (
								<Button
									disabled={busy || Boolean(current.decisionQueuedAt)}
									onClick={() =>
										void perform(() => sendReply(current), "Tilbudet er lagt i kø for utsending")
									}
								>
									<Mail />
									{current.decisionQueuedAt ? "Tilbudet sendes" : "Send tilbud"}
								</Button>
							)}
							{current.offerStatus !== "none" && <p>{offerLabels[current.offerStatus]}</p>}
						</div>
					)
				}
			/>
			{manualInterview && current && (
				<InterviewDialog
					period={period}
					candidate={current}
					people={overview.interviewers}
					onClose={() => setManualInterview(false)}
				/>
			)}
			{cancelInterview && current && (
				<CancelInterviewDialog candidate={current} onClose={() => setCancelInterview(false)} />
			)}
			{offerCandidate &&
				(() => {
					const row = overview.candidates.find((entry) => entry._id === offerCandidate);
					return row ? (
						<OfferDialog
							name={row.name}
							initialGroup={row.reviewedGroupId ?? row.groupId}
							initialEmail={row.reviewedWorkspaceEmail ?? ""}
							onClose={() => setOfferCandidate(null)}
							onSave={async (group, email) => {
								await setDecision({
									applicationId: row._id,
									expectedRevision: row.revision,
									decision: "accepted",
									reviewedGroupId: group,
									reviewedWorkspaceEmail: email,
								});
								toast.success("Tilbudet er lagret");
							}}
						/>
					) : null;
				})()}
			<SettingsDialog
				key={period._id}
				open={configure}
				onOpenChange={setConfigure}
				overview={overview}
				onSaved={() => toast.success("Innstillingene er lagret")}
			/>
			{calendars && (
				<CalendarDialog
					period={period}
					people={overview.interviewers}
					onClose={() => setCalendars(false)}
				/>
			)}
			<ConfirmDialog
				open={confirmSend}
				onOpenChange={setConfirmSend}
				title="Send svar til kandidatene?"
				description={`${pending.filter((entry) => entry.decision === "accepted").length} tilbud og ${pending.filter((entry) => entry.decision === "rejected").length} avslag.`}
				confirmLabel="Send svar"
				error={error}
				onConfirm={() =>
					perform(async () => {
						const results = await Promise.allSettled(pending.map(sendReply));
						const failed = results.find((result) => result.status === "rejected");
						if (failed?.status === "rejected") throw failed.reason;
					}, "Svarene er lagt i kø for utsending")
				}
			/>
		</section>
	);
}

function candidateColumns(openCandidate: (id: string) => void): ColumnDef<Candidate>[] {
	return [
		{
			accessorKey: "name",
			header: "Kandidat",
			cell: ({ row }) => (
				<Button variant="link" onClick={() => openCandidate(row.original._id)}>
					{row.original.name}
				</Button>
			),
		},
		{ accessorKey: "program", header: "Linje" },
		{ accessorKey: "year", header: "År" },
		{ accessorKey: "group", header: "Arbeidsgruppe" },
		{ accessorFn: (entry) => decisionLabels[entry.decision], header: "Vedtak" },
		{ accessorFn: (entry) => offerLabels[entry.offerStatus], header: "Svar" },
	];
}
