"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { makeSchedulingDays } from "@workspace/shared/admissions";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Callout } from "@workspace/ui/components/products/callout";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
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
import { CandidateDialog } from "./candidates/candidate-dialog";
import { CandidateFilters } from "./candidates/candidate-filters";
import { OfferDialog } from "./candidates/offer-dialog";
import { SelectionBoard } from "./candidates/selection-board";
import { DeliveryStatus } from "./delivery-status";
import { CalendarDialog } from "./interviews/calendar-dialog";
import { CancelInterviewDialog } from "./interviews/cancel-interview-dialog";
import { InterviewCalendar } from "./interviews/interview-calendar";
import { InterviewDialog } from "./interviews/interview-dialog";
import { type Decision, decisionLabels } from "./model";
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
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [offerCandidate, setOfferCandidate] = useState<string | null>(null);
	const [confirmSend, setConfirmSend] = useState(false);
	const [configure, setConfigure] = useState(false);
	const [calendars, setCalendars] = useState(false);
	const [roomDraft, setRoomDraft] = useState("");
	const [manualInterview, setManualInterview] = useState(false);
	const [cancelInterview, setCancelInterview] = useState(false);

	async function perform(action: () => Promise<unknown>, message: string) {
		if (busy) return false;
		setBusy(true);
		setError("");
		try {
			await action();
			toast.success(message);
			return true;
		} catch (cause) {
			setError(convexErrorMessage(cause, "Handlingen mislyktes. Prøv igjen."));
			return false;
		} finally {
			setBusy(false);
		}
	}
	if (overview === undefined) return <output>Laster opptaket…</output>;
	if (!overview)
		return (
			<section className={`admissions ${fullscreen ? "admissions-fullscreen" : ""}`}>
				<h1>Opptak</h1>
				<div className="admissions-empty">
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
		<section className={`admissions ${fullscreen ? "admissions-fullscreen" : ""}`}>
			<div className="admissions-title">
				<div>
					<h1>Opptak</h1>
					<p>{period.title}</p>
				</div>
				<div className="admissions-actions">
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
			<nav className="admissions-tabs" aria-label="Opptaksvisninger">
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
					onAssignRoom={(ids, room) =>
						perform(
							() =>
								assignRooms({
									periodId: period._id,
									expectedRevision: period.revision,
									applicationIds: ids as Id<"admissionApplications">[],
									room,
								}),
							"Romfordelingen er lagret",
						)
					}
				/>
			) : (
				<>
					<div className="admissions-toolbar">
						<CandidateFilters
							query={query}
							setQuery={setQuery}
							program={program}
							setProgram={setProgram}
							year={year}
							setYear={setYear}
						/>
						{view === "selection" && (
							<div className="admissions-actions">
								<span>Runde {period.round + 1}</span>
								<Button
									variant="outline"
									disabled={busy || !period.roundHistory.length}
									onClick={() =>
										void perform(
											() =>
												changeRound({
													periodId: period._id,
													expectedRevision: period.revision,
													direction: "previous",
												}),
											"Forrige runde er gjenopprettet",
										)
									}
								>
									<ChevronLeft />
									Forrige runde
								</Button>
								<Button
									disabled={busy || !candidates.some((entry) => entry.decision === "shortlist")}
									onClick={() =>
										void perform(
											() =>
												changeRound({
													periodId: period._id,
													expectedRevision: period.revision,
													direction: "next",
												}),
											"Neste runde er klar",
										)
									}
								>
									Neste runde
									<ChevronRight />
								</Button>
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
						<Table className="admissions-table">
							<TableHeader>
								<TableRow>
									{["Kandidat", "Linje", "År", "Arbeidsgruppe", "Vedtak", "Svar"].map((label) => (
										<TableHead key={label}>{label}</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.map((entry) => (
									<TableRow key={entry._id}>
										<TableCell>
											<Button variant="link" onClick={() => openCandidate(entry._id)}>
												{entry.name}
											</Button>
										</TableCell>
										<TableCell>{entry.program}</TableCell>
										<TableCell>{entry.year}</TableCell>
										<TableCell>{entry.group}</TableCell>
										<TableCell>{decisionLabels[entry.decision]}</TableCell>
										<TableCell>{offerLabels[entry.offerStatus]}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
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
									onClick={() =>
										void perform(
											() =>
												assignRooms({
													periodId: period._id,
													expectedRevision: period.revision,
													applicationIds: [current._id],
													room: roomDraft,
												}),
											"Romfordelingen er lagret",
										)
									}
								>
									Lagre rom
								</Button>
							)}
							{current.decision === "accepted" && !current.sent && (
								<Button
									disabled={busy || Boolean(current.decisionQueuedAt)}
									onClick={() =>
										void perform(
											() =>
												sendDecision({
													applicationId: current._id,
													expectedRevision: current.revision,
													idempotencyKey: `decision-${current._id}-${current.decisionRevision}`,
												}),
											"Tilbudet er lagt i kø for utsending",
										)
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
				period={period}
				onSaved={() => toast.success("Innstillingene er lagret")}
			/>
			{calendars && (
				<CalendarDialog
					period={period}
					people={overview.interviewers}
					onClose={() => setCalendars(false)}
				/>
			)}
			<Dialog open={confirmSend} onOpenChange={setConfirmSend}>
				<DialogContent aria-describedby={undefined}>
					<DialogHeader>
						<DialogTitle>Send svar til kandidatene?</DialogTitle>
					</DialogHeader>
					<p>
						{pending.filter((entry) => entry.decision === "accepted").length} tilbud og{" "}
						{pending.filter((entry) => entry.decision === "rejected").length} avslag.
					</p>
					<Button
						disabled={busy}
						onClick={() =>
							void perform(async () => {
								const results = await Promise.allSettled(
									pending.map((entry) =>
										sendDecision({
											applicationId: entry._id,
											expectedRevision: entry.revision,
											idempotencyKey: `decision-${entry._id}-${entry.decisionRevision}`,
										}),
									),
								);
								const failed = results.find((result) => result.status === "rejected");
								if (failed?.status === "rejected") throw failed.reason;
								setConfirmSend(false);
							}, "Svarene er lagt i kø for utsending")
						}
					>
						Send svar
					</Button>
				</DialogContent>
			</Dialog>
		</section>
	);
}
