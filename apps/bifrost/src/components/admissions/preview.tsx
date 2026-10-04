"use client";
import { STUDY_YEARS } from "@workspace/shared/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Callout } from "@workspace/ui/components/products/callout";
import { SearchField } from "@workspace/ui/components/search-field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import {
	AlertTriangle,
	CalendarDays,
	Check,
	ChevronLeft,
	ChevronRight,
	Coffee,
	Columns3,
	ExternalLink,
	Mail,
	MapPin,
	Maximize2,
	Plus,
	Settings2,
	Trash2,
	Users,
	WandSparkles,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CandidateDialog } from "./candidate-dialog";
import {
	advanceRound,
	type Candidate,
	clock,
	type Decision,
	dateLabel,
	days,
	decisionLabels,
	decisions,
	defaults,
	type Interview,
	type Interviewer,
	makeSlots,
	match,
	programs,
	roomUrl,
	type Settings,
	seedCandidates,
	team,
} from "./model";
import "./preview.css";
import { AvailabilityDialog } from "./availability-dialog";

type View = "calendar" | "candidates" | "selection";

export default function AdmissionsPreview() {
	const [candidates, setCandidates] = useState(seedCandidates);
	const [settings, setSettings] = useState<Settings>(defaults);
	const [interviewers, setInterviewers] = useState(team);
	const [savedCalendars, setSavedCalendars] = useState<Record<string, Interviewer>>({});
	const slots = useMemo(() => makeSlots(settings), [settings]);
	const [interviews, setInterviews] = useState<Interview[]>(() =>
		match(seedCandidates(), makeSlots(defaults), team),
	);
	const [view, setView] = useState<View>("calendar");
	const [selected, setSelected] = useState<string | null>(null);
	const [configure, setConfigure] = useState(false);
	const [availabilityOpen, setAvailabilityOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [program, setProgram] = useState("");
	const [year, setYear] = useState("");
	const [week, setWeek] = useState(0);
	const [day, setDay] = useState<string | null>(null);
	const [fullscreen, setFullscreen] = useState(false);
	const [approved, setApproved] = useState(false);
	const [confirm, setConfirm] = useState<"send" | "delete" | null>(null);
	const [active, setActive] = useState(true);
	const [rooms, setRooms] = useState<Record<string, string>>({});
	const [selectingRooms, setSelectingRooms] = useState(false);
	const [roomSelection, setRoomSelection] = useState<string[]>([]);
	const [bulkRoom, setBulkRoom] = useState("");
	const assignRoom = (ids: string[], room: string) => {
		setRooms((current) => ({
			...current,
			...Object.fromEntries(ids.map((id) => [id, room.trim()])),
		}));
		setApproved(false);
	};
	const [roundHistory, setRoundHistory] = useState<Record<string, Decision>[]>([]);
	const round = roundHistory.length + 1;
	const [dragging, setDragging] = useState<string | null>(null);
	const patch = (id: string, data: Partial<Candidate>) =>
		setCandidates((list) => list.map((c) => (c.id === id ? { ...c, ...data } : c)));
	const candidate = candidates.find((c) => c.id === selected);
	const filtered = candidates.filter(
		(c) =>
			c.name.toLocaleLowerCase("nb").includes(query.toLocaleLowerCase("nb")) &&
			(!program || c.program === program) &&
			(!year || c.year === Number(year)),
	);
	const unmatched = candidates.filter((c) => !interviews.some((i) => i.candidateId === c.id));
	const visibleDays = day ? [day] : days.slice(week * 5, week * 5 + 5);
	const rebuild = () => {
		setInterviews(match(candidates, slots, interviewers));
		setApproved(false);
		toast.success("Nytt forslag er klart");
	};
	const interview = interviews.find((i) => i.candidateId === selected);
	const selectedSlot = slots.find((s) => s.id === interview?.slotId);
	const pendingDecisions = candidates.filter(
		(c) => (c.decision === "accepted" || c.decision === "rejected") && !c.sent,
	);
	return (
		<section className={`admissions ${fullscreen ? "admissions-fullscreen" : ""}`}>
			<div className="admissions-preview">
				<span>Lokalt førsteutkast med testdata</span>
				<a href="http://localhost:3023/admissions" target="_blank" rel="noreferrer">
					Studentskjema <ExternalLink size={14} />
				</a>
			</div>
			<div className="admissions-title">
				<div>
					<h1>Opptak</h1>
					<div className="admissions-dates">
						<span>Søknader 1.–11. oktober</span>
						<span>Intervjuer 12.–23. oktober</span>
					</div>
				</div>
				<div className="admissions-actions">
					<Button
						variant="outline"
						size="icon"
						aria-label="Innstillinger"
						onClick={() => setConfigure(true)}
					>
						<Settings2 />
					</Button>
					<Button
						variant="outline"
						size="icon"
						aria-label={fullscreen ? "Avslutt storskjerm" : "Storskjerm"}
						onClick={() => setFullscreen(!fullscreen)}
					>
						{fullscreen ? <X /> : <Maximize2 />}
					</Button>
					{active && (
						<Button onClick={() => setConfirm("send")} disabled={!pendingDecisions.length}>
							<Mail />
							Send svar ({pendingDecisions.length})
						</Button>
					)}
				</div>
			</div>
			{!active ? (
				<div className="admissions-empty">
					<Users size={36} />
					<h2>Ingen aktive opptak</h2>
					<Button
						onClick={() => {
							setActive(true);
							setCandidates(seedCandidates());
							setRoundHistory([]);
							setInterviews(match(seedCandidates(), slots, interviewers));
							setApproved(false);
						}}
					>
						<Plus />
						Start opptak med testdata
					</Button>
				</div>
			) : (
				<>
					<nav className="admissions-tabs" aria-label="Opptaksvisninger">
						{(
							[
								["calendar", CalendarDays, "Intervjuer"],
								["candidates", Users, `Kandidater (${candidates.length})`],
								["selection", Columns3, "Utvelgelse"],
							] as const
						).map(([id, Icon, label]) => (
							<Button
								key={id}
								variant={view === id ? "secondary" : "ghost"}
								aria-pressed={view === id}
								onClick={() => setView(id)}
							>
								<Icon />
								{label}
							</Button>
						))}
					</nav>
					{view === "calendar" ? (
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
											toast.success(
												"Planen er godkjent i forhåndsvisningen. Ingen invitasjoner sendes.",
											);
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
										toast.success(
											`Rom satt til ${bulkRoom.trim()} for ${roomSelection.length} intervjuer`,
										);
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
															visibleDays.includes(
																slots.find((slot) => slot.id === i.slotId)?.day ?? "",
															),
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
											<span>
												{c.availability.length ? "Ingen felles tid" : "Mangler tilgjengelighet"}
											</span>
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
									<div className="admissions-day" key={date}>
										<button
											type="button"
											className="admissions-day-title"
											onClick={() => setDay(day ? null : date)}
										>
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
															aria-pressed={
																selectingRooms ? roomSelection.includes(c.id) : undefined
															}
															onClick={() =>
																selectingRooms
																	? setRoomSelection((ids) =>
																			ids.includes(c.id)
																				? ids.filter((id) => id !== c.id)
																				: [...ids, c.id],
																		)
																	: setSelected(c.id)
															}
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
											{!interviews.some(
												(i) => slots.find((s) => s.id === i.slotId)?.day === date,
											) && <p className="admissions-muted">Ingen intervjuer</p>}
										</div>
									</div>
								))}
							</div>
						</>
					) : (
						<>
							<div className="admissions-toolbar">
								<div className="admissions-filters">
									<SearchField
										value={query}
										onChange={setQuery}
										placeholder="Søk etter kandidat"
										className="sm:w-72"
									/>
									<Select
										value={program || "all"}
										onValueChange={(value) => setProgram(value === "all" ? "" : value)}
									>
										<SelectTrigger aria-label="Studieprogram" className="w-full sm:w-72">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">Alle linjer</SelectItem>
											{programs.map((p) => (
												<SelectItem key={p} value={p}>
													{p}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select
										value={year || "all"}
										onValueChange={(value) => setYear(value === "all" ? "" : value)}
									>
										<SelectTrigger aria-label="Studieår" className="w-full sm:w-36">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">Alle år</SelectItem>
											{STUDY_YEARS.map((y) => (
												<SelectItem key={y} value={String(y)}>
													{y}. år
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								{view === "selection" && (
									<div className="admissions-actions">
										<span>Runde {round}</span>
										<Button
											variant="outline"
											disabled={!roundHistory.length}
											onClick={() => {
												const previous = roundHistory.at(-1);
												if (!previous) return;
												setCandidates((list) =>
													list.map((c) =>
														previous[c.id] && previous[c.id] !== c.decision
															? { ...c, decision: previous[c.id] ?? c.decision, sent: false }
															: c,
													),
												);
												setRoundHistory((history) => history.slice(0, -1));
											}}
										>
											<ChevronLeft />
											Forrige runde
										</Button>
										<Button
											disabled={!candidates.some((c) => c.decision === "shortlist")}
											onClick={() => {
												setRoundHistory((history) => [
													...history,
													Object.fromEntries(candidates.map((c) => [c.id, c.decision])),
												]);
												setCandidates(advanceRound(candidates));
											}}
										>
											Neste runde
											<ChevronRight />
										</Button>
									</div>
								)}
							</div>
							{view === "selection" && (
								<Callout className="mb-6">
									<p className="max-w-prose text-sm leading-relaxed">
										Dra kandidatene du vil beholde til «Videre», eller bruk menyen på kortet. Trykk
										«Neste runde» for å vurdere dem på nytt. De som står igjen i «Til vurdering»
										flyttes til «Avslått». «Tatt opp» beholdes.
									</p>
									<p className="mt-2 max-w-prose text-sm leading-relaxed">
										Du kan hente kandidater tilbake fra «Avslått». «Forrige runde» gjenoppretter
										fordelingen før siste rundebytte. Ingen svar sendes før du velger «Send svar».
									</p>
								</Callout>
							)}
							{view === "selection" ? (
								<div className="admissions-board">
									{decisions.map((status) => (
										<section
											className={`admissions-lane admissions-lane-${status}`}
											key={status}
											onDragOver={(e) => e.preventDefault()}
											onDrop={(e) => {
												e.preventDefault();
												if (dragging) {
													patch(dragging, { decision: status, sent: false });
													setDragging(null);
												}
											}}
											aria-label={decisionLabels[status]}
										>
											<h2>
												{decisionLabels[status]}
												<span>{filtered.filter((c) => c.decision === status).length}</span>
											</h2>
											{filtered
												.filter((c) => c.decision === status)
												.map((c) => (
													<article
														className="admissions-candidate"
														key={c.id}
														draggable
														onDragStart={() => setDragging(c.id)}
														onDragEnd={() => setDragging(null)}
													>
														<button type="button" onClick={() => setSelected(c.id)}>
															<strong>{c.name}</strong>
															<span>{c.program}</span>
															<div>
																<span>{c.year}. år</span>
																<span>{c.group}</span>
															</div>
														</button>
														<Select
															value={c.decision}
															onValueChange={(value) =>
																patch(c.id, { decision: value as Decision, sent: false })
															}
														>
															<SelectTrigger aria-label={`Flytt ${c.name}`} className="w-full">
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
													</article>
												))}
										</section>
									))}
								</div>
							) : (
								<div className="admissions-table-wrap">
									<Table className="admissions-table">
										<TableHeader>
											<TableRow>
												<TableHead>Kandidat</TableHead>
												<TableHead>Linje</TableHead>
												<TableHead>År</TableHead>
												<TableHead>Arbeidsgruppe</TableHead>
												<TableHead>Intervju</TableHead>
												<TableHead>Vedtak</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filtered.map((c) => {
												const booking = interviews.find((i) => i.candidateId === c.id);
												const slot = slots.find((s) => s.id === booking?.slotId);
												return (
													<TableRow key={c.id}>
														<TableCell>
															<button type="button" onClick={() => setSelected(c.id)}>
																{c.name}
															</button>
														</TableCell>
														<TableCell>{c.program}</TableCell>
														<TableCell>{c.year}.</TableCell>
														<TableCell>{c.group}</TableCell>
														<TableCell>
															{slot ? `${dateLabel(slot.day)} ${clock(slot.start)}` : "Mangler tid"}
														</TableCell>
														<TableCell>
															{decisionLabels[c.decision]}
															{c.sent && " (sendt)"}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
									{!filtered.length && (
										<p className="admissions-muted">Ingen kandidater matcher filtrene.</p>
									)}
								</div>
							)}
						</>
					)}
				</>
			)}
			<CandidateDialog
				candidate={candidate}
				selectedSlot={selectedSlot}
				interview={interview}
				settings={settings}
				room={rooms[selected ?? ""] ?? selectedSlot?.room ?? ""}
				onClose={() => setSelected(null)}
				onPatch={(id, data) => {
					patch(id, data);
					if (data.availability) setApproved(false);
				}}
				onRoomChange={(room) => {
					if (!selected) return;
					setRooms((current) => ({ ...current, [selected]: room }));
					setApproved(false);
				}}
			/>
			<AvailabilityDialog
				open={availabilityOpen}
				onOpenChange={setAvailabilityOpen}
				interviewers={interviewers}
				onSave={(updated) => {
					setSavedCalendars((current) => ({ ...current, [updated.id]: updated }));
					const next = interviewers.map((person) => (person.id === updated.id ? updated : person));
					setInterviewers(next);
					setInterviews(match(candidates, slots, next));
					setApproved(false);
				}}
			/>
			<Dialog open={configure} onOpenChange={setConfigure}>
				<DialogContent
					className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
					aria-describedby={undefined}
				>
					<DialogHeader>
						<DialogTitle>Opptaksinnstillinger</DialogTitle>
					</DialogHeader>
					<div className="admissions-profile">
						<div className="admissions-settings-grid">
							{(
								[
									["duration", "Intervju (min)", 5, 60],
									["buffer", "Buffer (min)", 0, 30],
									["breakEvery", "Pause etter antall intervjuer", 1, 6],
									["breakMinutes", "Pause (min)", 5, 60],
								] as const
							).map(([key, label, min, max]) => (
								<Label key={key} htmlFor={key}>
									{label}
									<Input
										id={key}
										type="number"
										min={min}
										max={max}
										value={settings[key]}
										onChange={(e) => {
											const n = Number(e.target.value);
											if (n >= min && n <= max) {
												setSettings({ ...settings, [key]: n });
												setInterviews([]);
												setApproved(false);
											}
										}}
									/>
								</Label>
							))}
						</div>
						<Label className="admissions-check">
							<Checkbox
								checked={settings.lunch}
								onCheckedChange={(checked) => {
									setSettings({ ...settings, lunch: checked === true });
									setInterviews([]);
									setApproved(false);
								}}
							/>
							Lunsj 12:00–12:30
						</Label>
						<Label htmlFor="interview-room">
							Rom
							<Input
								id="interview-room"
								value={settings.room}
								onChange={(e) => {
									setSettings({ ...settings, room: e.target.value });
									setApproved(false);
								}}
							/>
						</Label>
						<a href={roomUrl(settings.room)} target="_blank" rel="noreferrer">
							<MapPin size={16} />
							Åpne romkart
							<ExternalLink size={14} />
						</a>
						<section>
							<h3>Intervjuere</h3>
							{team.map((p) => (
								<Label className="admissions-check" key={p.id}>
									<Checkbox
										checked={interviewers.some((i) => i.id === p.id)}
										onCheckedChange={(checked) => {
											setInterviewers(
												checked === true
													? [...interviewers, savedCalendars[p.id] ?? p]
													: interviewers.filter((i) => i.id !== p.id),
											);
											setInterviews([]);
											setApproved(false);
										}}
									/>
									{p.name}
								</Label>
							))}
						</section>
						<Button
							onClick={() => {
								rebuild();
								setConfigure(false);
							}}
						>
							<WandSparkles />
							Lagre og finn tider
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								setConfigure(false);
								setConfirm("delete");
							}}
						>
							<Trash2 />
							Avslutt og slett opptaket
						</Button>
					</div>
				</DialogContent>
			</Dialog>
			<Dialog
				open={confirm !== null}
				onOpenChange={(open) => {
					if (!open) setConfirm(null);
				}}
			>
				<DialogContent aria-describedby={undefined}>
					<DialogHeader>
						<DialogTitle>{confirm === "delete" ? "Slett opptaket?" : "Send vedtak?"}</DialogTitle>
					</DialogHeader>
					{confirm === "delete" ? (
						<p>
							Søknader, intervjunotater og intervjuplan fjernes. Medlemskontoer beholdes. Dette er
							testdata.
						</p>
					) : (
						<p>
							{pendingDecisions.filter((c) => c.decision === "accepted").length} tilbud og{" "}
							{pendingDecisions.filter((c) => c.decision === "rejected").length} avslag. I denne
							forhåndsvisningen sendes ingen e-post.
						</p>
					)}
					<Button
						variant={confirm === "delete" ? "destructive" : "default"}
						onClick={() => {
							if (confirm === "delete") {
								setCandidates([]);
								setInterviews([]);
								setActive(false);
							} else {
								setCandidates((list) =>
									list.map((c) =>
										pendingDecisions.some((p) => p.id === c.id) ? { ...c, sent: true } : c,
									),
								);
								toast.success("Utsending simulert");
							}
							setConfirm(null);
						}}
					>
						{confirm === "delete" ? "Slett testdata" : "Simuler utsending"}
					</Button>
				</DialogContent>
			</Dialog>
		</section>
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
