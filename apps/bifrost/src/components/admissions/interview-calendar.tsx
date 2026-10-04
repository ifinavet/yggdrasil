"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
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
import { toast } from "sonner";
import {
	type Candidate,
	clock,
	dateLabel,
	days,
	type Interview,
	type Settings,
	type Slot,
	team,
} from "./model";
export function InterviewCalendar({
	candidates,
	interviews,
	slots,
	settings,
	rooms,
	approved,
	setApproved,
	setSelected,
	setAvailabilityOpen,
	assignRoom,
	rebuild,
}: Readonly<{
	candidates: Candidate[];
	interviews: Interview[];
	slots: Slot[];
	settings: Settings;
	rooms: Record<string, string>;
	approved: boolean;
	setApproved: (approved: boolean) => void;
	setSelected: (id: string) => void;
	setAvailabilityOpen: (open: boolean) => void;
	assignRoom: (ids: string[], room: string) => void;
	rebuild: () => void;
}>) {
	const [week, setWeek] = useState(0);
	const [day, setDay] = useState<string | null>(null);
	const [selectingRooms, setSelectingRooms] = useState(false);
	const [roomSelection, setRoomSelection] = useState<string[]>([]);
	const [bulkRoom, setBulkRoom] = useState("");
	const unmatched = candidates.filter(
		(candidate) => !interviews.some((interview) => interview.candidateId === candidate.id),
	);
	const visibleDays = day ? [day] : days.slice(week * 5, week * 5 + 5);
	const selectCandidate = (id: string) => {
		if (!selectingRooms) {
			setSelected(id);
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
							setWeek(0);
							setDay(null);
						}}
					>
						<ChevronLeft />
					</Button>
					<strong>{week === 0 ? "12.–16. oktober" : "19.–23. oktober"}</strong>
					<Button
						variant="outline"
						size="icon"
						aria-label="Neste uke"
						disabled={week === 1}
						onClick={() => {
							setWeek(1);
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
						onClick={() => setDay(days[week * 5] ?? null)}
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
					<Button variant="outline" onClick={() => setAvailabilityOpen(true)}>
						<CalendarDays />
						Kalendere
					</Button>
					<Button variant="outline" onClick={rebuild}>
						<WandSparkles />
						Finn tider
					</Button>
					<Button
						disabled={approved || interviews.length === 0}
						onClick={() => {
							setApproved(true);
							toast.success("Planen er godkjent i forhåndsvisningen. Ingen invitasjoner sendes.");
						}}
					>
						<Check />
						{approved ? "Godkjent forslag" : "Godkjenn forslag"}
					</Button>
				</div>
			</div>
			{selectingRooms && (
				<form
					className="admissions-toolbar"
					onSubmit={(event) => {
						event.preventDefault();
						if (!bulkRoom.trim() || !roomSelection.length) return;
						assignRoom(roomSelection, bulkRoom);
						toast.success(`Rom satt til ${bulkRoom.trim()} for ${roomSelection.length} intervjuer`);
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
											visibleDays.includes(slots.find((slot) => slot.id === i.slotId)?.day ?? ""),
										)
										.map((i) => i.candidateId),
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
					{unmatched.map((c) => (
						<button type="button" key={c.id} onClick={() => setSelected(c.id)}>
							{c.name}
							<span>{c.availability.length ? "Ingen felles tid" : "Mangler tilgjengelighet"}</span>
						</button>
					))}
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
						interviews={interviews}
						slots={slots}
						settings={settings}
						rooms={rooms}
						selectingRooms={selectingRooms}
						roomSelection={roomSelection}
						onSelect={selectCandidate}
					/>
				))}
			</div>
		</>
	);
}

function InterviewerAvatars({ ids }: Readonly<{ ids: string[] }>) {
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
	slots,
	settings,
	rooms,
	selectingRooms,
	roomSelection,
	onSelect,
}: Readonly<{
	date: string;
	onDayClick: () => void;
	candidates: Candidate[];
	interviews: Interview[];
	slots: Slot[];
	settings: Settings;
	rooms: Record<string, string>;
	selectingRooms: boolean;
	roomSelection: string[];
	onSelect: (id: string) => void;
}>) {
	return (
		<div className="admissions-day">
			<button type="button" className="admissions-day-title" onClick={onDayClick}>
				{dateLabel(date)}
			</button>
			<div className="admissions-day-content">
				{interviews
					.filter((i) => slots.find((s) => s.id === i.slotId)?.day === date)
					.sort(
						(a, b) =>
							(slots.find((s) => s.id === a.slotId)?.start ?? 0) -
							(slots.find((s) => s.id === b.slotId)?.start ?? 0),
					)
					.map((i) => {
						const c = candidates.find((c) => c.id === i.candidateId);
						const slot = slots.find((s) => s.id === i.slotId);
						if (!c || !slot) return null;
						return (
							<button
								type="button"
								className="admissions-interview"
								style={{ order: slot.start }}
								key={i.candidateId}
								aria-pressed={selectingRooms ? roomSelection.includes(c.id) : undefined}
								onClick={() => onSelect(c.id)}
							>
								<time>
									{clock(slot.start)}–{clock(slot.start + settings.duration)}
								</time>
								<strong>{c.name}</strong>
								<span>{c.program}</span>
								<span className="inline-flex items-center gap-1">
									<MapPin size={13} />
									{rooms[c.id] || slot.room}
								</span>
								<div className="admissions-interview-footer">
									<span>{c.year}. år</span>
									<div className="admissions-avatars">
										<InterviewerAvatars ids={i.interviewers} />
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
				{!interviews.some((i) => slots.find((s) => s.id === i.slotId)?.day === date) && (
					<p className="admissions-muted">Ingen intervjuer</p>
				)}
			</div>
		</div>
	);
}
