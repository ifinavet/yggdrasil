"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { formatOsloDate, osloDateTimeToEpoch } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { useAppForm } from "@workspace/ui/components/form";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { defaults, type Overview } from "../model";
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
		defaultValues: formValues(period),
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
						const epoch = (input: string) => {
							const [day, time] = input.split("T");
							return osloDateTimeToEpoch(day ?? "", time ?? "");
						};
						await create({
							...settings,
							title: value.title,
							applicationStartAt: epoch(value.applicationStartAt),
							applicationEndAt: epoch(value.applicationEndAt),
							interviewStartAt: epoch(value.interviewStartAt),
							interviewEndAt: epoch(value.interviewEndAt),
							retentionAt: epoch(value.retentionAt),
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
		if (open) form.reset(formValues(period));
	}, [open, period, form]);
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
						<>
							<form.AppField name="title">
								{(field) => <field.Input label="Navn" id="admissions-title" required />}
							</form.AppField>
							{(
								[
									["applicationStartAt", "Søknader åpner"],
									["applicationEndAt", "Søknadsfrist"],
									["interviewStartAt", "Første intervjudag"],
									["interviewEndAt", "Siste intervjudag"],
									["retentionAt", "Slett opplysningene"],
								] as const
							).map(([key, label]) => (
								<form.AppField key={key} name={key}>
									{(field) => <field.Input label={label} id={key} required type="datetime-local" />}
								</form.AppField>
							))}
						</>
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
						{(field) => <field.Input label="Rom" id="default-room" required />}
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
					<form.Subscribe
						selector={(state) => state.isSubmitting || state.values.interviewerIds.length < 2}
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

function formValues(period?: Doc<"admissionPeriods">) {
	return {
		title: period?.title ?? "",
		applicationStartAt: period
			? formatOsloDate(period.applicationStartAt, "yyyy-MM-dd'T'HH:mm")
			: "",
		applicationEndAt: period ? formatOsloDate(period.applicationEndAt, "yyyy-MM-dd'T'HH:mm") : "",
		interviewStartAt: period ? formatOsloDate(period.interviewStartAt, "yyyy-MM-dd'T'HH:mm") : "",
		interviewEndAt: period ? formatOsloDate(period.interviewEndAt, "yyyy-MM-dd'T'HH:mm") : "",
		retentionAt: period ? formatOsloDate(period.retentionAt, "yyyy-MM-dd'T'HH:mm") : "",
		interviewerIds: period?.interviewers.map((person) => person.userId) ?? ([] as Id<"users">[]),
		duration: period?.duration ?? defaults.duration,
		buffer: period?.buffer ?? defaults.buffer,
		breakEvery: period?.breakEvery ?? defaults.breakEvery,
		breakMinutes: period?.breakMinutes ?? defaults.breakMinutes,
		lunch: period?.lunch ?? defaults.lunch,
		room: period?.room ?? defaults.room,
	};
}
