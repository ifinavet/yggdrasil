"use client";
import { api } from "@workspace/backend/convex/api";
import { formatOsloDate } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Callout } from "@workspace/ui/components/products/callout";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation } from "convex/react";
import { CalendarDays, ExternalLink, Mail, MapPin } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { CancelInterviewDialog } from "../interviews/cancel-interview-dialog";
import { InterviewDialog } from "../interviews/interview-dialog";
import {
	type Candidate,
	clock,
	type Decision,
	dateLabel,
	decisionLabels,
	decisionLocked,
	decisions,
	type Interviewer,
	offerLabels,
	roomUrl,
	type Settings,
} from "../model";
import { type TimeSuggestion, TimeSuggestions } from "./time-suggestions";

export function CandidateDialog({
	candidate,
	settings,
	onClose,
	onDecisionChange,
	team,
	error,
	busy,
	onSaveRoom,
	onSendReply,
}: Readonly<{
	candidate: Candidate;
	settings: Settings;
	onClose: () => void;
	onDecisionChange: (decision: Decision) => void;
	team: Interviewer[];
	error: string;
	busy: boolean;
	onSaveRoom: (room: string) => void;
	onSendReply: () => void;
}>) {
	const [noteDraft, setNoteDraft] = useState(candidate.notes ?? "");
	const [roomEdit, setRoomEdit] = useState<string>();
	const [manualInterview, setManualInterview] = useState(false);
	const [suggestion, setSuggestion] = useState<TimeSuggestion>();
	const [moveInterview, setMoveInterview] = useState(false);
	const [cancelInterview, setCancelInterview] = useState(false);
	const addNote = useMutation(api.admissions.mutations.addNote);
	const { pending: savingNotes, error: noteError, run: saveNotes } = useAsyncAction();
	const interview = candidate.interview;
	const roomDraft = roomEdit ?? interview?.room ?? settings.room;
	return (
		<Fragment>
			<Dialog open onOpenChange={(open) => !open && onClose()}>
				<DialogContent
					className="admissions-candidate-dialog max-h-[90dvh] overflow-y-auto p-6 sm:max-w-5xl sm:p-8"
					aria-describedby={undefined}
				>
					<DialogHeader>
						<DialogTitle className="text-left text-2xl">{candidate.name}</DialogTitle>
					</DialogHeader>
					<div className="admissions-profile-meta mb-4 flex flex-wrap gap-x-6 gap-y-2 text-base">
						<span>{candidate.program}</span>
						<span>{candidate.year}. år</span>
						<span>{candidate.group}</span>
					</div>
					<div className="admissions-profile admissions-profile-layout [&_p]:wrap-anywhere grid grid-cols-1 gap-8 text-base leading-relaxed md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1.5 [&_a]:underline [&_h3]:mb-3 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-2 [&_h3]:font-semibold [&_label]:flex [&_label]:flex-col [&_label]:items-start [&_label]:gap-3 [&_p]:max-w-prose [&_p]:whitespace-pre-wrap">
						<div className="admissions-profile-main flex min-w-0 flex-col gap-8">
							<section>
								<h3>Fortell litt om deg selv</h3>
								<p>{candidate.about}</p>
							</section>
							<section>
								<h3>Hvorfor vil du bli med i Navet?</h3>
								<p>{candidate.motivation}</p>
							</section>

							<Label htmlFor="interview-notes">
								Intervjunotater
								<Textarea
									id="interview-notes"
									className="font-normal text-base leading-relaxed"
									rows={4}
									value={noteDraft}
									onChange={(e) => setNoteDraft(e.target.value)}
									placeholder="Notater fra samtalen"
								/>
							</Label>
							{noteError && <Callout tone="danger">{noteError}</Callout>}
							<Button
								disabled={busy || savingNotes}
								onClick={() =>
									void saveNotes(
										() =>
											addNote({
												applicationId: candidate._id,
												expectedRevision: candidate.revision,
												note: noteDraft,
											}),
										() => toast.success("Notatene er lagret"),
										"Handlingen mislyktes. Prøv igjen.",
									)
								}
							>
								Lagre notater
							</Button>
							<div className="admissions-decision flex flex-col gap-3">
								<Label htmlFor="candidate-decision">Vedtak</Label>
								<Select
									value={candidate.decision}
									disabled={savingNotes || decisionLocked(candidate)}
									onValueChange={(value) => onDecisionChange(value as Decision)}
								>
									<SelectTrigger id="candidate-decision" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{decisions.map((d) => (
											<SelectItem key={d} value={d}>
												{decisionLabels[d]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<aside className="admissions-profile-interview min-w-0 self-start rounded-xl bg-muted p-5 [&_section]:mb-4 [&_section]:flex [&_section]:flex-col [&_section]:gap-4">
							<section>
								<h3>
									<CalendarDays size={16} />
									Intervju
								</h3>
								{interview ? (
									<>
										<p>
											{formatOsloDate(interview.startAt, "EEE d. MMM HH:mm")}–
											{formatOsloDate(interview.endAt, "HH:mm")}
										</p>
										<Label htmlFor="candidate-room">
											Rom
											<Input
												id="candidate-room"
												value={roomDraft}
												onChange={(event) => setRoomEdit(event.target.value)}
												onBlur={(event) => {
													if (!event.target.value.trim()) setRoomEdit(settings.room);
												}}
											/>
										</Label>
										<a href={roomUrl(roomDraft || interview.room)} target="_blank" rel="noreferrer">
											<MapPin size={15} />
											{roomDraft || interview.room}
											<ExternalLink size={13} />
										</a>
										<p>
											{interview.interviewerIds
												.map((id) => team.find((p) => p.id === id)?.name)
												.join(" og ")}
										</p>
									</>
								) : (
									<div className="grid gap-3">
										<p>
											{candidate.availability.length
												? "Ingen felles tid med to intervjuere."
												: "Kandidaten har ikke oppgitt tilgjengelighet."}
										</p>
										<TimeSuggestions
											applicationId={candidate._id}
											periodId={settings._id}
											team={team}
											onPick={setSuggestion}
										/>
									</div>
								)}
								<details className="admissions-availability-details [&_summary]:cursor-pointer [&_summary]:py-2 [&_summary]:font-medium">
									<summary>Tilgjengelige tider</summary>
									<div className="flex flex-col gap-2">
										{candidate.availability.map((window) => (
											<p key={`${window.day}-${window.start}-${window.end}`}>
												{dateLabel(window.day)} {clock(window.start)}–{clock(window.end)}
											</p>
										))}
									</div>
								</details>
							</section>
							<div className="grid gap-3">
								{error && <Callout tone="danger">{error}</Callout>}
								{!interview && (
									<Button variant="outline" onClick={() => setManualInterview(true)}>
										Sett intervjutid
									</Button>
								)}
								{interview && (
									<Button variant="outline" onClick={() => setMoveInterview(true)}>
										Flytt intervju
									</Button>
								)}
								{interview && (
									<Button variant="outline" onClick={() => setCancelInterview(true)}>
										Avlys intervju
									</Button>
								)}
								{interview && (
									<Button
										disabled={busy || savingNotes || !roomDraft.trim()}
										onClick={() => onSaveRoom(roomDraft)}
									>
										Lagre rom
									</Button>
								)}
								{candidate.decision === "accepted" && !candidate.decisionSentAt && (
									<Button
										disabled={busy || savingNotes || Boolean(candidate.decisionQueuedAt)}
										onClick={onSendReply}
									>
										<Mail />
										{candidate.decisionQueuedAt ? "Tilbudet sendes" : "Send tilbud"}
									</Button>
								)}
								{candidate.offerStatus !== "none" && <p>{offerLabels[candidate.offerStatus]}</p>}
							</div>
						</aside>
					</div>
				</DialogContent>
			</Dialog>
			{(manualInterview || suggestion) && (
				<InterviewDialog
					period={settings}
					candidate={candidate}
					people={team}
					initial={suggestion}
					onClose={() => {
						setManualInterview(false);
						setSuggestion(undefined);
					}}
				/>
			)}
			{moveInterview && interview && (
				<InterviewDialog
					period={settings}
					candidate={candidate}
					people={team}
					existing={interview}
					onClose={() => setMoveInterview(false)}
				/>
			)}
			{cancelInterview && (
				<CancelInterviewDialog candidate={candidate} onClose={() => setCancelInterview(false)} />
			)}
		</Fragment>
	);
}
