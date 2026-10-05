"use client";
import { formatOsloDate } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { CalendarDays, ExternalLink, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
	type Candidate,
	clock,
	type Decision,
	dateLabel,
	decisionLabels,
	decisionLocked,
	decisions,
	type Interview,
	type Interviewer,
	roomUrl,
	type Settings,
} from "../model";

export function CandidateDialog({
	candidate,
	interview,
	settings,
	room,
	onClose,
	onDecisionChange,
	onRoomChange,
	team,
	onSaveNotes,
	actions,
}: Readonly<{
	candidate: Candidate | undefined;
	interview: Interview | undefined;
	settings: Settings;
	room: string;
	onClose: () => void;
	onDecisionChange: (decision: Decision) => void;
	onRoomChange: (room: string) => void;
	team: Interviewer[];
	onSaveNotes: (notes: string) => Promise<void>;
	actions?: ReactNode;
}>) {
	const [noteDraft, setNoteDraft] = useState(candidate?.notes ?? "");
	return (
		<Dialog
			open={Boolean(candidate)}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				className="admissions-candidate-dialog max-h-[90dvh] overflow-y-auto p-6 sm:max-w-5xl sm:p-8"
				aria-describedby={undefined}
			>
				{candidate && (
					<>
						<DialogHeader>
							<DialogTitle className="text-left text-2xl">{candidate.name}</DialogTitle>
						</DialogHeader>
						<div className="admissions-profile-meta">
							<span>{candidate.program}</span>
							<span>{candidate.year}. år</span>
							<span>{candidate.group}</span>
						</div>
						<div className="admissions-profile admissions-profile-layout">
							<div className="admissions-profile-main">
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
								<Button onClick={() => void onSaveNotes(noteDraft)}>Lagre notater</Button>
								<div className="admissions-decision">
									<Label htmlFor="candidate-decision">Vedtak</Label>
									<Select
										value={candidate.decision}
										disabled={decisionLocked(candidate)}
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
							<aside className="admissions-profile-interview">
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
													value={room}
													onChange={(event) => onRoomChange(event.target.value)}
													onBlur={(event) => {
														if (!event.target.value.trim()) onRoomChange(settings.room);
													}}
												/>
											</Label>
											<a href={roomUrl(room || interview.room)} target="_blank" rel="noreferrer">
												<MapPin size={15} />
												{room || interview.room}
												<ExternalLink size={13} />
											</a>
											<p>
												{interview.interviewerIds
													.map((id) => team.find((p) => p.id === id)?.name)
													.join(" og ")}
											</p>
										</>
									) : (
										<div>
											<p>
												{candidate.availability.length
													? "Ingen felles tid med to intervjuere."
													: "Kandidaten har ikke oppgitt tilgjengelighet."}
											</p>
										</div>
									)}
									<details className="admissions-availability-details">
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
								{actions}
							</aside>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
