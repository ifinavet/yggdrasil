"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { isClockTime, isIsoDate } from "@workspace/shared/time";
import { isHttpUrl } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Switch } from "@workspace/ui/components/switch";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation } from "convex/react";
import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { convexErrorMessage } from "@/utils/convex-error";

const optionalDay = z.string().refine((value) => value === "" || isIsoDate(value), "Velg en dato.");

function settingsSchema(semester: Doc<"semesters">) {
	return z
		.object({
			firstDate: optionalDay,
			lastDate: optionalDay,
			applicationDeadline: optionalDay,
			hardDeadline: z.boolean(),
			defaultEventStartTime: z
				.string()
				.refine((value) => value === "" || isClockTime(value), "Skriv et klokkeslett, som 16:15."),
			termsUrl: z
				.string()
				.refine(
					(value) => value.trim() === "" || isHttpUrl(value.trim()),
					"Skriv en hel lenke som starter med https://.",
				),
			infoText: z.string(),
		})
		.superRefine((value, ctx) => {
			const hasRange = semester.firstDate !== undefined || semester.lastDate !== undefined;
			if (value.firstDate === "" && (value.lastDate !== "" || hasRange)) {
				ctx.addIssue({ code: "custom", path: ["firstDate"], message: "Velg første dato." });
			}
			if (value.lastDate === "" && (value.firstDate !== "" || hasRange)) {
				ctx.addIssue({ code: "custom", path: ["lastDate"], message: "Velg siste dato." });
			}
			if (value.firstDate && value.lastDate && value.firstDate > value.lastDate) {
				ctx.addIssue({
					code: "custom",
					path: ["lastDate"],
					message: "Siste dato må være etter første dato.",
				});
			}
			if (value.applicationDeadline === "" && semester.applicationDeadline !== undefined) {
				ctx.addIssue({
					code: "custom",
					path: ["applicationDeadline"],
					message: "Søknadsfristen kan endres, men ikke fjernes.",
				});
			}
		});
}

/**
 * The semester's first and last date, the application deadline, when events made from the plan
 * start, the terms link and the information text. Every value starts empty until an editor sets it.
 */
export function SemesterSettingsForm({ semester }: Readonly<{ semester: Doc<"semesters"> }>) {
	const setRange = useMutation(api.semesterPlanning.semesters.mutations.setRange);
	const updateSettings = useMutation(api.semesterPlanning.semesters.mutations.updateSettings);
	const [saveError, setSaveError] = useState<string>();
	const locked = semester.status === "closed";

	// useForm takes these options again on every render, so the validator follows the live semester.
	const form = useForm({
		defaultValues: {
			firstDate: semester.firstDate ?? "",
			lastDate: semester.lastDate ?? "",
			applicationDeadline: semester.applicationDeadline ?? "",
			hardDeadline: semester.hardDeadline ?? false,
			defaultEventStartTime: semester.defaultEventStartTime ?? "",
			termsUrl: semester.termsUrl ?? "",
			infoText: semester.infoText ?? "",
		},
		validators: { onSubmit: settingsSchema(semester) },
		onSubmit: async ({ value, formApi }) => {
			setSaveError(undefined);
			const rangeChanged =
				value.firstDate !== (semester.firstDate ?? "") ||
				value.lastDate !== (semester.lastDate ?? "");
			// The range and the settings are two mutations. Once the range is saved, a failure after
			// it says so; the next save compares with the new range and only sends the settings.
			let rangeSaved = false;
			try {
				if (rangeChanged && value.firstDate && value.lastDate) {
					await setRange({
						semesterId: semester._id,
						firstDate: value.firstDate,
						lastDate: value.lastDate,
					});
					rangeSaved = true;
				}
				await updateSettings({
					semesterId: semester._id,
					...(value.applicationDeadline ? { applicationDeadline: value.applicationDeadline } : {}),
					hardDeadline: value.hardDeadline,
					defaultEventStartTime: value.defaultEventStartTime,
					termsUrl: value.termsUrl.trim(),
					infoText: value.infoText.trim(),
				});
				formApi.reset(value);
				toast.success(
					rangeChanged ? "Innstillingene og datoene er lagret." : "Innstillingene er lagret.",
				);
			} catch (error) {
				const message = convexErrorMessage(error, "Kunne ikke lagre innstillingene. Prøv igjen.");
				setSaveError(
					rangeSaved ? `Datoene er lagret, men ikke resten av innstillingene. ${message}` : message,
				);
			}
		},
	});

	return (
		<form
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<fieldset disabled={locked} className="grid min-w-0 gap-3.5">
				<div className="grid gap-3 min-[400px]:grid-cols-2">
					<form.Field name="firstDate">
						{(field) => {
							const isInvalid = !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor="semester-first-date">Første dato</FieldLabel>
									<DatePicker
										id="semester-first-date"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										disabled={locked}
										invalid={isInvalid}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
					<form.Field name="lastDate">
						{(field) => {
							const isInvalid = !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor="semester-last-date">Siste dato</FieldLabel>
									<DatePicker
										id="semester-last-date"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										disabled={locked}
										invalid={isInvalid}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</div>

				<form.Field name="applicationDeadline">
					{(field) => {
						const isInvalid = !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="semester-deadline">Søknadsfrist</FieldLabel>
								<DatePicker
									id="semester-deadline"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									disabled={locked}
									invalid={isInvalid}
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="hardDeadline">
					{(field) => (
						<div className="flex items-center justify-between gap-3 rounded-lg border p-3">
							<div className="min-w-0">
								<p id="semester-hard-deadline-label" className="font-medium text-sm">
									Absolutt frist
								</p>
								<p className="text-muted-foreground text-xs">
									{field.state.value
										? "Skjemaet på Hugin stenger etter fristen."
										: "Sene søknader tas inn til dere stenger for søknader."}
								</p>
							</div>
							<Switch
								checked={field.state.value}
								aria-labelledby="semester-hard-deadline-label"
								disabled={locked}
								onCheckedChange={field.handleChange}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="defaultEventStartTime">
					{(field) => {
						const isInvalid = !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="semester-start-time">Starttid for arrangementer</FieldLabel>
								<Input
									id="semester-start-time"
									type="time"
									lang="nb"
									className="w-fit appearance-none bg-background tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="termsUrl">
					{(field) => {
						const isInvalid = !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="semester-terms">Standardvilkår</FieldLabel>
								<div className="relative">
									<FileText
										aria-hidden
										className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
									/>
									<Input
										id="semester-terms"
										type="url"
										inputMode="url"
										className="pl-9"
										value={field.state.value}
										onChange={(event) => field.handleChange(event.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
									/>
								</div>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="infoText">
					{(field) => (
						<Field>
							<FieldLabel htmlFor="semester-info">Informasjon til bedrifter</FieldLabel>
							<Textarea
								id="semester-info"
								rows={4}
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
							/>
						</Field>
					)}
				</form.Field>
			</fieldset>

			{saveError && (
				<p role="alert" className="font-medium text-destructive text-sm">
					{saveError}
				</p>
			)}

			{locked ? (
				<p className="text-muted-foreground text-sm">
					Semesteret er stengt. Lås det opp for å endre innstillingene.
				</p>
			) : (
				<form.Subscribe selector={(state) => [state.isSubmitting, state.isDirty] as const}>
					{([isSubmitting, isDirty]) => (
						<Button type="submit" disabled={isSubmitting || !isDirty} className="w-full sm:w-fit">
							{isSubmitting ? "Lagrer …" : "Lagre innstillinger"}
						</Button>
					)}
				</form.Subscribe>
			)}
		</form>
	);
}
