"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { ADMISSION_PERIOD_TIMES } from "@workspace/shared/admissions";
import { DATE_PATTERNS, osloDateTimeToEpoch } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Fold } from "@workspace/ui/components/fold";
import { useAppForm } from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { Switch } from "@workspace/ui/components/switch";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation, useQuery } from "convex/react";
import { addDays, format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { defaults, type Overview, roomUrl } from "../model";
import { CloseDialog } from "./close-dialog";

type Board = { userId: Id<"users">; fullName: string }[];

export function SettingsDialog({
	open,
	onOpenChange,
	overview,
	onSaved,
	onClosed,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	overview: Overview;
	onSaved: () => void;
	onClosed?: () => void;
}>) {
	const board = useQuery(api.users.organization.queries.getTheBoard, {});
	const { period } = overview;
	const [closeOpen, setCloseOpen] = useState(false);
	const counts = {
		pendingOffers: overview.candidates.filter((candidate) => candidate.offerStatus === "pending")
			.length,
		futureInterviews: overview.interviews.filter(
			(interview) => interview.status === "scheduled" && interview.startAt > Date.now(),
		).length,
		unsentDecisions: overview.candidates.filter(
			(candidate) =>
				(candidate.decision === "accepted" || candidate.decision === "rejected") &&
				!candidate.decisionSentAt,
		).length,
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
				aria-describedby={undefined}
			>
				<DialogHeader>
					<DialogTitle>Opptaksinnstillinger</DialogTitle>
				</DialogHeader>
				{open && board && (
					<PeriodForm
						key={period.revision}
						period={period}
						board={board}
						onSaved={() => {
							onSaved();
							onOpenChange(false);
						}}
					/>
				)}
				<div className="pt-4">
					<Button type="button" variant="destructive" onClick={() => setCloseOpen(true)}>
						Avslutt opptaket
					</Button>
					<CloseDialog
						open={closeOpen}
						onOpenChange={setCloseOpen}
						periodId={period._id}
						counts={counts}
						onClosed={() => {
							onOpenChange(false);
							onClosed?.();
						}}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function StartAdmissionForm({ onSaved }: Readonly<{ onSaved: () => void }>) {
	const board = useQuery(api.users.organization.queries.getTheBoard, {});
	if (!board) return <output>Laster styret…</output>;
	return <PeriodForm board={board} onSaved={onSaved} />;
}

function PeriodForm({
	period,
	board,
	onSaved,
}: Readonly<{ period?: Doc<"admissionPeriods">; board: Board; onSaved: () => void }>) {
	const create = useMutation(api.admissions.mutations.createPeriod);
	const update = useMutation(api.admissions.board.updateSettings);
	const { error, run } = useAsyncAction();
	const form = useAppForm({
		defaultValues: formValues(board, period),
		onSubmit: ({ value }) =>
			run(
				async () => {
					const settings = {
						duration: value.duration,
						buffer: value.buffer,
						breakEvery: value.breakEvery,
						breakMinutes: value.breakMinutes,
						lunch: value.lunch,
						room: value.room,
					};
					if (period) {
						await update({
							periodId: period._id,
							expectedRevision: period.revision,
							settings,
							interviewers: value.interviewerIds.map((userId) => ({
								userId,
								selectedCalendarIds:
									period.interviewers.find((person) => person.userId === userId)
										?.selectedCalendarIds ?? [],
							})),
						});
					} else {
						await create({
							...settings,
							applicationStartAt: osloDateTimeToEpoch(value.applicationStart, value.opensAt),
							applicationEndAt: osloDateTimeToEpoch(value.applicationEnd, value.closesAt),
							interviewStartAt: osloDateTimeToEpoch(
								value.interviewStart,
								ADMISSION_PERIOD_TIMES.interviewDayStarts,
							),
							interviewEndAt: osloDateTimeToEpoch(
								value.interviewEnd,
								ADMISSION_PERIOD_TIMES.interviewDayEnds,
							),
							hidden: !value.visible,
							interviewers: value.interviewerIds.map((userId) => ({
								userId,
								selectedCalendarIds: [],
							})),
						});
					}
					onSaved();
				},
				undefined,
				"Kunne ikke lagre opptaket.",
			),
	});

	const settingsFields = (
		<div className="grid gap-5">
			<div className="grid grid-cols-2 gap-5">
				{(
					[
						["duration", "Intervju (min)", 5, 120],
						["buffer", "Buffer (min)", 0, 60],
						["breakEvery", "Pause etter antall intervjuer", 1, 12],
						["breakMinutes", "Pause (min)", 0, 60],
					] as const
				).map(([key, label, min, max]) => (
					<form.AppField key={key} name={key}>
						{(field) => (
							<field.Input label={label} id={key} type="number" min={min} max={max} required />
						)}
					</form.AppField>
				))}
			</div>
			<form.AppField name="room">
				{(field) => (
					<div className="grid gap-1.5">
						<field.Input label="Standardrom" id="default-room" required />
						{field.state.value.trim() && (
							<a
								href={roomUrl(field.state.value)}
								target="_blank"
								rel="noreferrer"
								className="w-fit text-muted-foreground text-sm underline-offset-4 hover:underline"
							>
								{roomUrl(field.state.value).replace("https://", "")}
							</a>
						)}
					</div>
				)}
			</form.AppField>
			<form.Field name="lunch">
				{(field) => (
					<label htmlFor="admissions-lunch" className="flex items-center gap-3">
						<Checkbox
							id="admissions-lunch"
							checked={field.state.value}
							onCheckedChange={(checked) => field.handleChange(checked === true)}
						/>
						Lunsj 12:00–12:30
					</label>
				)}
			</form.Field>
		</div>
	);

	return (
		<form
			className="grid max-w-xl gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			{error && (
				<p role="alert" className="text-destructive">
					{error}
				</p>
			)}
			{!period && (
				<>
					<Field>
						<FieldLabel id="application-label">Søknadsperiode</FieldLabel>
						<div className="flex flex-wrap items-end gap-4">
							<form.Subscribe
								selector={(state) => [state.values.applicationStart, state.values.applicationEnd]}
							>
								{([from = "", to = ""]) => (
									<DateRange
										labelledBy="application-label"
										from={from}
										to={to}
										onChange={(start, end) => {
											form.setFieldValue("applicationStart", start);
											form.setFieldValue("applicationEnd", end);
										}}
									/>
								)}
							</form.Subscribe>
							<form.Field name="opensAt">
								{(field) => (
									<TimeInput
										id="opens-at"
										label="Åpner kl."
										value={field.state.value}
										onChange={field.handleChange}
									/>
								)}
							</form.Field>
							<form.Field name="closesAt">
								{(field) => (
									<TimeInput
										id="closes-at"
										label="Frist kl."
										value={field.state.value}
										onChange={field.handleChange}
									/>
								)}
							</form.Field>
						</div>
					</Field>
					<Field>
						<FieldLabel id="interview-label">Intervjudager</FieldLabel>
						<div>
							<form.Subscribe
								selector={(state) => [
									state.values.interviewStart,
									state.values.interviewEnd,
									state.values.applicationEnd,
								]}
							>
								{([from = "", to = "", applicationEnd = ""]) => (
									<DateRange
										labelledBy="interview-label"
										from={from}
										to={to}
										after={applicationEnd}
										onChange={(start, end) => {
											form.setFieldValue("interviewStart", start);
											form.setFieldValue("interviewEnd", end);
										}}
									/>
								)}
							</form.Subscribe>
						</div>
					</Field>
				</>
			)}
			<form.Field name="interviewerIds">
				{(field) => (
					<Field>
						<FieldLabel id="interviewers-label">
							Intervjuere ({field.state.value.length})
						</FieldLabel>
						<SearchSelect
							multiple
							aria-labelledby="interviewers-label"
							items={board.map((person) => ({ id: person.userId, label: person.fullName }))}
							value={field.state.value}
							onChange={(ids) => field.handleChange(ids as Id<"users">[])}
							placeholder="Velg intervjuere"
							searchPlaceholder="Søk etter intervjuer"
						/>
					</Field>
				)}
			</form.Field>
			{period ? (
				settingsFields
			) : (
				<>
					<form.Subscribe selector={(state) => state.values}>
						{(values) => (
							<Fold
								title={
									<>
										Oppsett{" "}
										<span className="font-normal text-muted-foreground">
											{values.duration} min, {values.buffer} min buffer, pause etter{" "}
											{values.breakEvery}, standardrom {values.room}
											{values.lunch ? ", lunsj" : ""}
										</span>
									</>
								}
							>
								<div className="p-4">{settingsFields}</div>
							</Fold>
						)}
					</form.Subscribe>
					<form.Field name="visible">
						{(field) => (
							<label htmlFor="admissions-visible" className="flex items-center gap-3 font-medium">
								<Switch
									id="admissions-visible"
									checked={field.state.value}
									onCheckedChange={field.handleChange}
								/>
								Vis på ifinavet.no
							</label>
						)}
					</form.Field>
				</>
			)}
			<form.Subscribe
				selector={(state) =>
					state.isSubmitting ||
					state.values.interviewerIds.length < 2 ||
					(!period &&
						![
							state.values.applicationStart,
							state.values.applicationEnd,
							state.values.interviewStart,
							state.values.interviewEnd,
							state.values.opensAt,
							state.values.closesAt,
						].every(Boolean))
				}
			>
				{(disabled) => (
					<Button type="submit" disabled={disabled} className="justify-self-start">
						{period ? "Lagre innstillinger" : "Opprett opptak"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

function DateRange({
	labelledBy,
	from,
	to,
	after,
	onChange,
}: Readonly<{
	labelledBy: string;
	from: string;
	to: string;
	after?: string;
	onChange: (from: string, to: string) => void;
}>) {
	const day = (value: string) => (value ? parseISO(value) : undefined);
	const label = (value: string) => format(parseISO(value), DATE_PATTERNS.numericDate);
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					aria-labelledby={labelledBy}
					className={from ? "font-normal" : "font-normal text-muted-foreground"}
				>
					<CalendarIcon />
					{[from, to].filter(Boolean).map(label).join(" – ") || "Velg datoer"}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="range"
					ISOWeek
					locale={nb}
					numberOfMonths={2}
					defaultMonth={day(from) ?? day(after ?? "")}
					disabled={{ before: after ? addDays(parseISO(after), 1) : new Date() }}
					selected={{ from: day(from), to: day(to) }}
					onSelect={(range) =>
						onChange(
							range?.from ? format(range.from, "yyyy-MM-dd") : "",
							range?.to ? format(range.to, "yyyy-MM-dd") : "",
						)
					}
				/>
			</PopoverContent>
		</Popover>
	);
}

function TimeInput({
	id,
	label,
	value,
	onChange,
}: Readonly<{ id: string; label: string; value: string; onChange: (value: string) => void }>) {
	return (
		<Field className="w-fit">
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				type="time"
				lang="nb"
				required
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</Field>
	);
}

function formValues(board: Board, period?: Doc<"admissionPeriods">) {
	return {
		applicationStart: "",
		applicationEnd: "",
		opensAt: ADMISSION_PERIOD_TIMES.applicationOpens as string,
		closesAt: ADMISSION_PERIOD_TIMES.applicationCloses as string,
		interviewStart: "",
		interviewEnd: "",
		visible: false,
		interviewerIds:
			period?.interviewers.map((person) => person.userId) ?? board.map((person) => person.userId),
		duration: period?.duration ?? defaults.duration,
		buffer: period?.buffer ?? defaults.buffer,
		breakEvery: period?.breakEvery ?? defaults.breakEvery,
		breakMinutes: period?.breakMinutes ?? defaults.breakMinutes,
		lunch: period?.lunch ?? defaults.lunch,
		room: period?.room ?? (defaults.room as string),
	};
}
