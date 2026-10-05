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
			<div className="admissions-toolbar">
				<div className="admissions-actions">
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
				<div className="admissions-actions">
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
					className="admissions-toolbar"
					onSubmit={async (event) => {
						event.preventDefault();
						if (!bulkRoom.trim() || !roomSelection.length) return;
						const saved = await onAssignRoom(roomSelection, bulkRoom);
						if (saved === false) return;
						setRoomSelection([]);
						setSelectingRooms(false);
					}}
				>
					<div className="admissions-actions">
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
					<div className="admissions-actions">
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
				<div className="admissions-attention">
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
				className="admissions-calendar"
				style={{
					gridTemplateColumns: `repeat(${visibleDays.length}, minmax(${day ? "280" : "175"}px, 1fr))`,
				}}
			>
				{visibleDays.map((date) => (
					<InterviewDay
						key={date}
						date={date}
						onDayClick={() => setDay(day ? null : date)}
						candidates={candidates}
						interviews={interviews
							.filter((i) => localWindow(i.startAt, 0, settings.timezone).day === date)
							.sort((a, b) => a.startAt - b.startAt)}
						settings={settings}
						team={team}
						selectingRooms={selectingRooms}
						roomSelection={roomSelection}
						onSelect={selectCandidate}
					/>
				))}
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

function InterviewDay({
	date,
	onDayClick,
	candidates,
	interviews,
	settings,
	selectingRooms,
	roomSelection,
	onSelect,
	team,
}: Readonly<{
	date: string;
	onDayClick: () => void;
	candidates: Candidate[];
	interviews: Interview[];
	settings: Settings;
	selectingRooms: boolean;
	roomSelection: string[];
	onSelect: (id: string) => void;
	team: Interviewer[];
}>) {
	return (
		<div className="admissions-day">
			<button type="button" className="admissions-day-title" onClick={onDayClick}>
				{dateLabel(date)}
			</button>
			<div className="admissions-day-content">
				{interviews.map((i) => {
					const c = candidates.find((c) => c._id === i.applicationId);
					if (!c) return null;
					const slot = localWindow(i.startAt, (i.endAt - i.startAt) / 60_000, settings.timezone);
					return (
						<button
							type="button"
							className="admissions-interview"
							style={{ order: slot.start }}
							key={i.applicationId}
							aria-pressed={selectingRooms ? roomSelection.includes(c._id) : undefined}
							onClick={() => onSelect(c._id)}
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
							<div className="admissions-interview-footer">
								<span>{c.year}. år</span>
								<div className="admissions-avatars">
									<InterviewerAvatars ids={i.interviewerIds} team={team} />
								</div>
							</div>
						</button>
					);
				})}
				{settings.lunch && (
					<div className="admissions-break" style={{ order: 720 }}>
						<Coffee size={14} />
						12:00–12:30 Lunsj
					</div>
				)}
				{interviews.length === 0 && <p className="admissions-muted">Ingen intervjuer</p>}
			</div>
		</div>
	);
}
