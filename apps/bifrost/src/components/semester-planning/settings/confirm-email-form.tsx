"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import {
	CONFIRM_EMAIL_COMPANY,
	CONFIRM_EMAIL_DEFAULTS,
	CONFIRM_EMAIL_LIMITS,
	confirmEmailFor,
} from "@workspace/shared/semester/confirm-email";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

/** The company the preview is written for. */
const PREVIEW_COMPANY = "FJORDKODE AS";

const schema = z.object({
	subject: z
		.string()
		.trim()
		.min(1, "Skriv et emne.")
		.max(CONFIRM_EMAIL_LIMITS.subject, `Emnet kan ha høyst ${CONFIRM_EMAIL_LIMITS.subject} tegn.`),
	text: z
		.string()
		.trim()
		.min(1, "Skriv en tekst.")
		.max(CONFIRM_EMAIL_LIMITS.text, `Teksten kan ha høyst ${CONFIRM_EMAIL_LIMITS.text} tegn.`),
});

/** A value equal to the default is stored as empty, so the semester follows later default changes. */
function stored(value: string, fallback: string): string {
	return value.trim() === fallback ? "" : value.trim();
}

/**
 * The email a company gets after sending the bedpres form: its subject and text, with a preview.
 * The confirm button and the line with the link are always added under the text, so they cannot
 * be removed by mistake.
 */
export function ConfirmEmailForm({ semester }: Readonly<{ semester: Doc<"semesters"> }>) {
	const updateSettings = useMutation(api.semesterPlanning.semesters.mutations.updateSettings);
	const [saveError, setSaveError] = useState<string>();
	const locked = semester.status === "closed";
	const custom = Boolean(semester.confirmEmailSubject || semester.confirmEmailText);

	const form = useForm({
		defaultValues: {
			subject: semester.confirmEmailSubject ?? CONFIRM_EMAIL_DEFAULTS.subject,
			text: semester.confirmEmailText ?? CONFIRM_EMAIL_DEFAULTS.text,
		},
		validators: { onSubmit: schema },
		onSubmit: async ({ value, formApi }) => {
			setSaveError(undefined);
			try {
				await updateSettings({
					semesterId: semester._id,
					confirmEmailSubject: stored(value.subject, CONFIRM_EMAIL_DEFAULTS.subject),
					confirmEmailText: stored(value.text, CONFIRM_EMAIL_DEFAULTS.text),
				});
				formApi.reset(value);
				toast.success("Bekreftelses-e-posten er lagret.");
			} catch (error) {
				setSaveError(convexErrorMessage(error, "Kunne ikke lagre e-posten. Prøv igjen."));
			}
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const isDirty = useStore(form.store, (state) => state.isDirty);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const preview = confirmEmailFor(
		{ confirmEmailSubject: values.subject, confirmEmailText: values.text },
		PREVIEW_COMPANY,
	);

	return (
		<form
			className="grid min-w-0 gap-4 lg:grid-cols-2"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<fieldset disabled={locked} className="grid min-w-0 content-start gap-3.5">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="secondary">{custom ? "Egen tekst" : "Standardtekst"}</Badge>
					<p className="text-muted-foreground text-xs">
						Skriv {CONFIRM_EMAIL_COMPANY} der bedriftens navn skal stå. Knappen og lenken legges til
						under teksten.
					</p>
				</div>
				<form.Field name="subject">
					{(field) => {
						const isInvalid = !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="confirm-email-subject">Emne</FieldLabel>
								<Input
									id="confirm-email-subject"
									value={field.state.value}
									aria-invalid={isInvalid}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
				<form.Field name="text">
					{(field) => {
						const isInvalid = !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="confirm-email-text">Tekst</FieldLabel>
								<Textarea
									id="confirm-email-text"
									rows={9}
									value={field.state.value}
									aria-invalid={isInvalid}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
								/>
								<FieldDescription>Tom linje gir nytt avsnitt.</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
				{saveError && (
					<p role="alert" className="text-destructive text-sm">
						{saveError}
					</p>
				)}
				<div className="flex flex-wrap gap-2">
					<Button type="submit" disabled={!isDirty || isSubmitting}>
						{isSubmitting ? "Lagrer …" : "Lagre e-posten"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							form.setFieldValue("subject", CONFIRM_EMAIL_DEFAULTS.subject);
							form.setFieldValue("text", CONFIRM_EMAIL_DEFAULTS.text);
						}}
					>
						Bruk standardteksten
					</Button>
				</div>
			</fieldset>

			<section aria-label="Forhåndsvisning" className="min-w-0 rounded-lg border bg-muted/40 p-4">
				<p className="text-muted-foreground text-xs">Forhåndsvisning for {PREVIEW_COMPANY}</p>
				<p className="mt-1 font-semibold text-sm">{preview.subject}</p>
				<div className="mt-3 grid gap-3 rounded-md bg-background p-4 text-sm">
					{preview.paragraphs.map((paragraph, index) => (
						<p key={`${index}-${paragraph.slice(0, 20)}`} className="whitespace-pre-line">
							{paragraph}
						</p>
					))}
					<span className="w-fit rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">
						Bekreft søknaden
					</span>
					<p className="text-muted-foreground">
						Lenken virker i 24 timer. Virker ikke knappen, kan dere lime inn denne lenken i
						nettleseren: …
					</p>
				</div>
			</section>
		</form>
	);
}
