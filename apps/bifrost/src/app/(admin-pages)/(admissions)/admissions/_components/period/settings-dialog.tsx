"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { ADMISSION_PERIOD_TIMES } from "@workspace/shared/admissions";
import { osloDateTimeToEpoch } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Fold } from "@workspace/ui/components/fold";
import { useAppForm } from "@workspace/ui/components/form";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { Switch } from "@workspace/ui/components/switch";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { defaults, type Overview, roomUrl } from "../model";
import { CloseDialog } from "./close-dialog";

export function SettingsDialog({
	open,
	onOpenChange,
	overview,
	onSaved,
	onClosed,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	overview?: Overview;
	onSaved: () => void;
	onClosed?: () => void;
}>) {
	const board = useQuery(api.users.organization.queries.getTheBoard, {});
	const period = overview?.period;
	const create = useMutation(api.admissions.mutations.createPeriod);
	const update = useMutation(api.admissions.board.updateSettings);
	const { error, run } = useAsyncAction();
	const [closeOpen, setCloseOpen] = useState(false);
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
					onOpenChange(false);
				},
				undefined,
				"Kunne ikke lagre opptaket.",
			),
	});
	useEffect(() => {
		if (open) form.reset(formValues(board, period));
	}, [open, board, period, form]);
	const counts = {
		pendingOffers:
			overview?.candidates.filter((candidate) => candidate.offerStatus === "pending").length ?? 0,
		futureInterviews:
			overview?.interviews.filter(
				(interview) => interview.status === "scheduled" && interview.startAt > Date.now(),
			).length ?? 0,
		unsentDecisions:
			overview?.candidates.filter(
				(candidate) =>
					(candidate.decision === "accepted" || candidate.decision === "rejected") &&
					!candidate.decisionSentAt,
			).length ?? 0,
	};

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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
				aria-describedby={undefined}
			>
				<DialogHeader>
					<DialogTitle>{period ? "Opptaksinnstillinger" : "Start opptak"}</DialogTitle>
				</DialogHeader>
				<form
					className="grid gap-6"
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
						<div className="grid grid-cols-2 gap-5">
							{(
								[
									["applicationStart", "Søknader åpner"],
									["applicationEnd", "Søknadsfrist"],
									["opensAt", "Åpner kl."],
									["closesAt", "Frist kl."],
									["interviewStart", "Første intervjudag"],
									["interviewEnd", "Siste intervjudag"],
								] as const
							).map(([key, label]) => (
								<form.AppField key={key} name={key}>
									{(field) =>
										key === "opensAt" || key === "closesAt" ? (
											<field.Input label={label} id={key} type="time" required />
										) : (
											<Field>
												<FieldLabel htmlFor={key}>{label}</FieldLabel>
												<DatePicker
													id={key}
													value={field.state.value}
													onChange={field.handleChange}
												/>
											</Field>
										)
									}
								</form.AppField>
							))}
						</div>
					)}
					<form.Field name="interviewerIds">
						{(field) => (
							<Field>
								<FieldLabel id="interviewers-label">Intervjuere</FieldLabel>
								<SearchSelect
									multiple
									aria-labelledby="interviewers-label"
									items={board?.map((person) => ({ id: person.userId, label: person.fullName }))}
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
									<label
										htmlFor="admissions-visible"
										className="flex items-center gap-3 font-medium"
									>
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
								].every(Boolean))
						}
					>
						{(disabled) => (
							<Button type="submit" disabled={disabled}>
								{period ? "Lagre innstillinger" : "Start opptak"}
							</Button>
						)}
					</form.Subscribe>
				</form>
				{period && (
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
				)}
			</DialogContent>
		</Dialog>
	);
}

function formValues(
	board: { userId: Id<"users"> }[] | undefined,
	period?: Doc<"admissionPeriods">,
) {
	return {
		applicationStart: "",
		applicationEnd: "",
		opensAt: ADMISSION_PERIOD_TIMES.applicationOpens as string,
		closesAt: ADMISSION_PERIOD_TIMES.applicationCloses as string,
		interviewStart: "",
		interviewEnd: "",
		visible: false,
		interviewerIds:
			period?.interviewers.map((person) => person.userId) ??
			board?.map((person) => person.userId) ??
			([] as Id<"users">[]),
		duration: period?.duration ?? defaults.duration,
		buffer: period?.buffer ?? defaults.buffer,
		breakEvery: period?.breakEvery ?? defaults.breakEvery,
		breakMinutes: period?.breakMinutes ?? defaults.breakMinutes,
		lunch: period?.lunch ?? defaults.lunch,
		room: period?.room ?? (defaults.room as string),
	};
}
