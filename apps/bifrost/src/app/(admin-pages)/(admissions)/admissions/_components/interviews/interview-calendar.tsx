"use client";
import { localWindow } from "@workspace/shared/time";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
	AlertTriangle,
	CalendarDays,
	Check,
	ChevronLeft,
	ChevronRight,
	Coffee,
	MapPin,
	WandSparkles,
} from "lucide-react";
import { useState } from "react";
import {
	type Candidate,
	clock,
	dateLabel,
	type Interview,
	type Interviewer,
	type Settings,
} from "../model";
export function InterviewCalendar({
	candidates,
	interviews,
	settings,
	approved,
	onApprove,
	onOpenCandidate,
	onOpenCalendars,
	onAssignRoom,
	onGenerateSchedule,
	days,
	team,
}: Readonly<{
	candidates: Candidate[];
	interviews: Interview[];
	settings: Settings;
	approved: boolean;
	onApprove: () => void;
	days: string[];
	team: Interviewer[];
	onOpenCandidate: (id: string) => void;
	onOpenCalendars: () => void;
	onAssignRoom: (ids: string[], room: string) => boolean | Promise<boolean>;
	onGenerateSchedule: () => void;
}>) {
	const [week, setWeek] = useState(0);
	const [day, setDay] = useState<string | null>(null);
	const [selectingRooms, setSelectingRooms] = useState(false);
	const [roomSelection, setRoomSelection] = useState<string[]>([]);
	const [unmatchedOpen, setUnmatchedOpen] = useState(false);
	const [bulkRoom, setBulkRoom] = useState("");
	const unmatched = candidates.filter(
		(candidate) => !interviews.some((interview) => interview.applicationId === candidate._id),
	);
	const visibleDays = day ? [day] : days.slice(week * 7, week * 7 + 7);
	const selectCandidate = (id: string) => {
		if (!selectingRooms) {
			onOpenCandidate(id);
			return;
		}
		setRoomSelection((ids) =>
			ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id],
		);
	};

	return (
		<>
			<div className="admissions-toolbar flex flex-wrap items-center justify-between gap-4">
				<div className="admissions-actions flex flex-wrap items-center gap-3">
					<Button
						variant="outline"
						size="icon"
						aria-label="Forrige uke"
						disabled={week === 0}
						onClick={() => {
							setWeek((current) => Math.max(0, current - 1));
							setDay(null);
						}}
					>
						<ChevronLeft />
					</Button>
					<strong>
						{dateLabel(days[week * 7] ?? "")}–
						{dateLabel(days[Math.min(week * 7 + 7 - 1, days.length - 1)] ?? "")}
					</strong>
					<Button
						variant="outline"
						size="icon"
						aria-label="Neste uke"
						disabled={(week + 1) * 7 >= days.length}
						onClick={() => {
							setWeek((current) => current + 1);
							setDay(null);
						}}
					>
						<ChevronRight />
					</Button>
					<Button variant={day ? "outline" : "secondary"} onClick={() => setDay(null)}>
						Uke
					</Button>
					<Button
						variant={day ? "secondary" : "outline"}
						onClick={() => setDay(days[week * 7] ?? null)}
					>
						Dag
					</Button>
				</div>
				<div className="admissions-actions flex flex-wrap items-center gap-3">
					<Button
						variant={selectingRooms ? "secondary" : "outline"}
						onClick={() => {
							setSelectingRooms(!selectingRooms);
							setRoomSelection([]);
						}}
					>
						<MapPin />
						{selectingRooms ? "Avslutt romvalg" : "Sett rom"}
					</Button>
					<Button variant="outline" onClick={() => onOpenCalendars()}>
						<CalendarDays />
						Kalendere
					</Button>
					<Button variant="outline" onClick={onGenerateSchedule}>
						<WandSparkles />
						Finn tider
					</Button>
					<Button disabled={approved || interviews.length === 0} onClick={onApprove}>
						<Check />
						{approved ? "Godkjent forslag" : "Godkjenn forslag"}
					</Button>
				</div>
			</div>
			{selectingRooms && (
				<form
					className="admissions-toolbar flex flex-wrap items-center justify-between gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						if (!bulkRoom.trim() || !roomSelection.length) return;
						const saved = await onAssignRoom(roomSelection, bulkRoom);
						if (saved === false) return;
						setRoomSelection([]);
						setSelectingRooms(false);
					}}
				>
					<div className="admissions-actions flex flex-wrap items-center gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={() =>
								setRoomSelection(
									interviews
										.filter((i) =>
											visibleDays.includes(localWindow(i.startAt, 0, settings.timezone).day),
										)
										.map((i) => i.applicationId),
								)
							}
						>
							Velg alle i {day ? "dagen" : "uken"}
						</Button>
						<Button type="button" variant="ghost" onClick={() => setRoomSelection([])}>
							Fjern valg
						</Button>
						<span>{roomSelection.length} valgt</span>
					</div>
					<div className="admissions-actions flex flex-wrap items-center gap-3">
						<Label htmlFor="bulk-interview-room">Rom</Label>
						<Input
							id="bulk-interview-room"
							className="w-40"
							value={bulkRoom}
							onChange={(event) => setBulkRoom(event.target.value)}
							required
						/>
						<Button type="submit" disabled={!roomSelection.length || !bulkRoom.trim()}>
							Bruk på valgte
						</Button>
					</div>
				</form>
			)}
			{unmatched.length > 0 && (
				<div className="admissions-attention flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-amber-50 px-4 py-3 text-amber-950 text-sm dark:bg-amber-950 dark:text-amber-100">
					<AlertTriangle size={18} />
					<strong>{unmatched.length} trenger en tid</strong>
					<Button variant="ghost" onClick={() => setUnmatchedOpen(true)}>
						Vis kandidater
					</Button>
					<Dialog open={unmatchedOpen} onOpenChange={setUnmatchedOpen}>
						<DialogContent aria-describedby={undefined} className="max-h-[85dvh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>Kandidater uten intervjutid</DialogTitle>
							</DialogHeader>
							<div className="grid gap-2">
								{unmatched.map((candidate) => (
									<Button
										key={candidate._id}
										variant="ghost"
										className="h-auto justify-between gap-4 py-3 text-left"
										onClick={() => {
											setUnmatchedOpen(false);
											onOpenCandidate(candidate._id);
										}}
									>
										<span>{candidate.name}</span>
										<span className="text-muted-foreground text-xs">
											{candidate.availability.length
												? "Ingen felles tid"
												: "Mangler tilgjengelighet"}
										</span>
									</Button>
								))}
							</div>
						</DialogContent>
					</Dialog>
				</div>
			)}
			<div
				className="admissions-calendar grid min-w-0 items-start gap-3 overflow-x-auto pb-3"
				style={{
					gridTemplateColumns: `repeat(${visibleDays.length}, minmax(${day ? "280" : "175"}px, 1fr))`,
				}}
			>
				{visibleDays.map((date) => {
					const dayInterviews = interviews
						.filter((i) => localWindow(i.startAt, 0, settings.timezone).day === date)
						.sort((a, b) => a.startAt - b.startAt);
					return (
						<div key={date} className="admissions-day min-w-0 overflow-hidden rounded-xl bg-muted">
							<button
								type="button"
								className="admissions-day-title flex w-full cursor-pointer items-center justify-between gap-2 p-3.5 font-semibold text-sm capitalize focus-visible:outline-2 focus-visible:outline-ring"
								onClick={() => setDay(day ? null : date)}
							>
								{dateLabel(date)}
							</button>
							<div className="admissions-day-content flex flex-col gap-2 px-2 pb-3">
								{dayInterviews.map((i) => {
									const c = candidates.find((c) => c._id === i.applicationId);
									if (!c) return null;
									const slot = localWindow(
										i.startAt,
										(i.endAt - i.startAt) / 60_000,
										settings.timezone,
									);
									return (
										<button
											type="button"
											className="admissions-interview flex w-full min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-background p-3 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-accent [&>span]:text-muted-foreground [&>span]:text-xs [&>span]:leading-relaxed [&_strong]:text-sm [&_time]:text-muted-foreground [&_time]:text-xs [&_time]:tabular-nums"
											style={{ order: slot.start }}
											key={i.applicationId}
											aria-pressed={selectingRooms ? roomSelection.includes(c._id) : undefined}
											onClick={() => selectCandidate(c._id)}
										>
											<time>
												{clock(slot.start)}–{clock(slot.end)}
											</time>
											<strong>{c.name}</strong>
											<span>{c.program}</span>
											<span className="inline-flex items-center gap-1">
												<MapPin size={13} />
												{i.room}
											</span>
											<div className="admissions-interview-footer mt-1 flex items-center justify-between gap-2 text-xs">
												<span>{c.year}. år</span>
												<div className="admissions-avatars flex gap-1">
													<InterviewerAvatars ids={i.interviewerIds} team={team} />
												</div>
											</div>
										</button>
									);
								})}
								{settings.lunch && (
									<div
										className="admissions-break flex items-center justify-center gap-1.5 px-1 py-3 text-muted-foreground text-xs"
										style={{ order: 720 }}
									>
										<Coffee size={14} />
										12:00–12:30 Lunsj
									</div>
								)}
								{dayInterviews.length === 0 && (
									<p className="admissions-muted p-5 text-center text-muted-foreground text-sm">
										Ingen intervjuer
									</p>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}

function InterviewerAvatars({ ids, team }: Readonly<{ ids: string[]; team: Interviewer[] }>) {
	return ids.map((id) => {
		const person = team.find((member) => member.id === id);
		if (!person) return null;
		return (
			<Avatar key={id} title={person.name} className="size-9">
				<AvatarImage src={person.image} alt={person.name} className="object-cover" />
				<AvatarFallback>
					{person.name
						.split(" ")
						.map((part) => part[0])
						.join("")}
				</AvatarFallback>
			</Avatar>
		);
	});
}
