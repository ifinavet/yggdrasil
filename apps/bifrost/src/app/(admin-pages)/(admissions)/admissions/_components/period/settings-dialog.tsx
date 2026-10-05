"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { formatOsloDate, osloDateTimeToEpoch } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { defaults } from "../model";
import { CloseDialog } from "./close-dialog";

export function SettingsDialog({
	open,
	onOpenChange,
	period,
	onSaved,
	onClosed,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	period?: Doc<"admissionPeriods">;
	onSaved: () => void;
	onClosed?: () => void;
}>) {
	const board = useQuery(api.users.organization.queries.getTheBoard, {});
	const overview = useQuery(
		api.admissions.queries.adminOverview,
		period ? { periodId: period._id } : "skip",
	);
	const create = useMutation(api.admissions.mutations.createPeriod);
	const update = useMutation(api.admissions.board.updateSettings);
	const updateInterviewers = useMutation(api.admissions.board.updateInterviewers);
	const [error, setError] = useState("");
	const [closeOpen, setCloseOpen] = useState(false);
	const form = useForm({
		defaultValues: formValues(period),
		onSubmit: async ({ value }) => {
			setError("");
			try {
				const settings = {
					duration: value.duration,
					buffer: value.buffer,
					breakEvery: value.breakEvery,
					breakMinutes: value.breakMinutes,
					lunch: value.lunch,
					room: value.room,
				};
				if (period) {
					const interviewerChanges =
						value.interviewerIds.length !== period.interviewers.length ||
						value.interviewerIds.some(
							(id) => !period.interviewers.some((person) => person.userId === id),
						);
					const settingsChanges = Object.entries(settings).some(
						([key, next]) => period[key as keyof typeof settings] !== next,
					);
					let revision = period.revision;
					if (interviewerChanges) {
						await updateInterviewers({
							periodId: period._id,
							expectedRevision: revision,
							interviewers: value.interviewerIds.map((userId) => ({
								userId,
								selectedCalendarIds:
									period.interviewers.find((person) => person.userId === userId)
										?.selectedCalendarIds ?? [],
							})),
						});
						revision += 1;
					}
					if (settingsChanges)
						await update({ periodId: period._id, expectedRevision: revision, settings });
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
			} catch (cause) {
				setError(convexErrorMessage(cause, "Kunne ikke lagre opptaket."));
			}
		},
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
							<form.Field name="title">
								{(field) => (
									<Field>
										<FieldLabel htmlFor="admissions-title">Navn</FieldLabel>
										<Input
											id="admissions-title"
											required
											value={field.state.value}
											onChange={(event) => field.handleChange(event.target.value)}
										/>
									</Field>
								)}
							</form.Field>
							{(
								[
									["applicationStartAt", "Søknader åpner"],
									["applicationEndAt", "Søknadsfrist"],
									["interviewStartAt", "Første intervjudag"],
									["interviewEndAt", "Siste intervjudag"],
									["retentionAt", "Slett opplysningene"],
								] as const
							).map(([key, label]) => (
								<form.Field key={key} name={key}>
									{(field) => (
										<Field>
											<FieldLabel htmlFor={key}>{label}</FieldLabel>
											<Input
												id={key}
												required
												type="datetime-local"
												value={field.state.value}
												onChange={(event) => field.handleChange(event.target.value)}
											/>
										</Field>
									)}
								</form.Field>
							))}
						</>
					)}
					<form.Field name="interviewerIds">
						{(field) => (
							<fieldset className="grid gap-3">
								<legend className="font-medium">Intervjuere</legend>
								{board?.map((person) => (
									<label
										htmlFor={`interviewer-${person.userId}`}
										key={person.userId}
										className="flex items-center gap-3"
									>
										<Checkbox
											id={`interviewer-${person.userId}`}
											checked={field.state.value.includes(person.userId)}
											onCheckedChange={(checked) =>
												field.handleChange(
													checked === true
														? [...field.state.value, person.userId]
														: field.state.value.filter((id) => id !== person.userId),
												)
											}
										/>
										{person.fullName}
									</label>
								))}
							</fieldset>
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
							<form.Field key={key} name={key}>
								{(field) => (
									<Field>
										<FieldLabel htmlFor={key}>{label}</FieldLabel>
										<Input
											id={key}
											type="number"
											min={min}
											max={max}
											required
											value={field.state.value}
											onChange={(event) => field.handleChange(Number(event.target.value))}
										/>
									</Field>
								)}
							</form.Field>
						))}
					</div>
					<form.Field name="room">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="default-room">Rom</FieldLabel>
								<Input
									id="default-room"
									required
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
								/>
							</Field>
						)}
					</form.Field>
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
