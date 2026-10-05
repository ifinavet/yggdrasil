"use client";
import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { formatOsloDate, osloDateTimeToEpoch } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Callout } from "@workspace/ui/components/products/callout";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation } from "convex/react";

export function InterviewDialog({
	period,
	candidate,
	people,
	onClose,
}: Readonly<{
	period: Doc<"admissionPeriods">;
	candidate: { _id: Id<"admissionApplications">; revision: number; name: string };
	people: { id: Id<"users">; name: string; image: string }[];
	onClose: () => void;
}>) {
	const schedule = useMutation(api.admissions.mutations.scheduleInterview);
	const { error, run } = useAsyncAction();
	const form = useForm({
		defaultValues: {
			start: "",
			room: period.room,
			interviewerIds: [] as Id<"users">[],
			confirmed: false,
		},
		onSubmit: ({ value }) =>
			run(
				async () => {
					const [day, time] = value.start.split("T");
					const startAt = osloDateTimeToEpoch(day ?? "", time ?? "");
					await schedule({
						applicationId: candidate._id,
						expectedRevision: candidate.revision,
						startAt,
						room: value.room,
						interviewerIds: value.interviewerIds,
						expectedPeriodRevision: period.revision,
						candidateConfirmedOutsideForm: value.confirmed,
					});
					onClose();
				},
				undefined,
				"Kunne ikke lagre intervjutiden.",
			),
	});
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent aria-describedby={undefined} className="max-h-[90dvh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Sett intervjutid</DialogTitle>
				</DialogHeader>
				<p className="font-medium">{candidate.name}</p>
				<form
					className="grid gap-6"
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					{error && (
						<div role="alert">
							<Callout tone="danger">{error}</Callout>
						</div>
					)}
					<form.Field name="start">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="interview-time">Tidspunkt</FieldLabel>
								<Input
									id="interview-time"
									type="datetime-local"
									required
									min={formatOsloDate(period.interviewStartAt, "yyyy-MM-dd'T'HH:mm")}
									max={formatOsloDate(period.interviewEndAt, "yyyy-MM-dd'T'HH:mm")}
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
								/>
							</Field>
						)}
					</form.Field>
					<form.Field name="room">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="interview-room">Rom</FieldLabel>
								<Input
									id="interview-room"
									required
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
								/>
							</Field>
						)}
					</form.Field>
					<form.Field name="interviewerIds">
						{(field) => (
							<Field>
								<FieldLabel id="manual-interviewers-label">To intervjuere</FieldLabel>
								<SearchSelect
									multiple
									max={2}
									aria-labelledby="manual-interviewers-label"
									items={people.map((person) => ({
										id: person.id,
										label: person.name,
										image: person.image,
									}))}
									value={field.state.value}
									onChange={(ids) => field.handleChange(ids as Id<"users">[])}
									placeholder="Velg to intervjuere"
									searchPlaceholder="Søk etter intervjuer"
								/>
							</Field>
						)}
					</form.Field>
					<form.Field name="confirmed">
						{(field) => (
							<label htmlFor="manual-confirmed" className="flex items-start gap-3 text-sm">
								<Checkbox
									id="manual-confirmed"
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked === true)}
								/>
								<span>Søkeren har bekreftet denne tiden utenfor skjemaet</span>
							</label>
						)}
					</form.Field>
					<form.Subscribe
						selector={(state) => ({
							submitting: state.isSubmitting,
							count: state.values.interviewerIds.length,
						})}
					>
						{({ submitting, count }) => (
							<Button type="submit" disabled={submitting || count !== 2}>
								Lagre intervjutid
							</Button>
						)}
					</form.Subscribe>
				</form>
			</DialogContent>
		</Dialog>
	);
}
