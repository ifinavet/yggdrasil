"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import {
	COMPANY_EMAIL_LIMITS,
	CONFIRM_EMAIL_DEFAULTS,
	EMAIL_COMPANY,
	EMAIL_DATE,
	EMAIL_FIRST_NAME,
	EMAIL_PREVIEW,
	type EmailTemplate,
	OFFER_EMAIL_DEFAULTS,
} from "@workspace/shared/semester/company-emails";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { useAction, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

/** How long typing must pause before the preview is rendered again. */
const PREVIEW_DELAY_MS = 400;

/** An empty field is saved as empty, so the email uses the default for it. */
const schema = z.object({
	subject: z
		.string()
		.trim()
		.max(COMPANY_EMAIL_LIMITS.subject, `Emnet kan ha høyst ${COMPANY_EMAIL_LIMITS.subject} tegn.`),
	text: z
		.string()
		.trim()
		.max(COMPANY_EMAIL_LIMITS.text, `Teksten kan ha høyst ${COMPANY_EMAIL_LIMITS.text} tegn.`),
});

type EmailKind = {
	id: "confirm" | "offer";
	defaults: EmailTemplate;
	hint: string;
	saved: string;
	/** Where the semester keeps this email's subject and text. */
	fields: {
		subject: "confirmEmailSubject" | "offerEmailSubject";
		text: "confirmEmailText" | "offerEmailText";
	};
};

export const COMPANY_EMAILS = {
	confirm: {
		id: "confirm",
		defaults: CONFIRM_EMAIL_DEFAULTS,
		hint: `Skriv ${EMAIL_COMPANY} der bedriftens navn skal stå. Knappen og lenken legges til under teksten.`,
		saved: "Bekreftelses-e-posten er lagret.",
		fields: { subject: "confirmEmailSubject", text: "confirmEmailText" },
	},
	offer: {
		id: "offer",
		defaults: OFFER_EMAIL_DEFAULTS,
		hint: `Skriv ${EMAIL_COMPANY} for bedriftens navn, ${EMAIL_FIRST_NAME} for kontaktpersonens fornavn og ${EMAIL_DATE} for datoen. Knappen og lenken legges til under teksten.`,
		saved: "Tilbuds-e-posten er lagret.",
		fields: { subject: "offerEmailSubject", text: "offerEmailText" },
	},
} satisfies Record<string, EmailKind>;

/** A value equal to the default is stored as empty, so the semester follows later default changes. */
function stored(value: string, fallback: string): string {
	return value.trim() === fallback ? "" : value.trim();
}

/**
 * One of the emails a company gets about its application: its subject and text, with a preview of
 * the whole email as it is sent. The button and the lines with the link are always added under the
 * text, so they cannot be removed by mistake.
 */
export function CompanyEmailForm({
	semester,
	kind,
}: Readonly<{ semester: Doc<"semesters">; kind: EmailKind }>) {
	const updateSettings = useMutation(api.semesterPlanning.semesters.mutations.updateSettings);
	const [saveError, setSaveError] = useState<string>();
	const locked = semester.status === "closed";
	const own = { subject: semester[kind.fields.subject], text: semester[kind.fields.text] };
	const custom = Boolean(own.subject || own.text);

	const form = useForm({
		defaultValues: {
			subject: own.subject ?? kind.defaults.subject,
			text: own.text ?? kind.defaults.text,
		},
		validators: { onSubmit: schema },
		onSubmit: async ({ value, formApi }) => {
			setSaveError(undefined);
			try {
				await updateSettings({
					semesterId: semester._id,
					[kind.fields.subject]: stored(value.subject, kind.defaults.subject),
					[kind.fields.text]: stored(value.text, kind.defaults.text),
				});
				// Show what is sent: an emptied field is back to its default.
				formApi.reset({
					subject: value.subject.trim() || kind.defaults.subject,
					text: value.text.trim() || kind.defaults.text,
				});
				toast.success(kind.saved);
			} catch (error) {
				setSaveError(convexErrorMessage(error, "Kunne ikke lagre e-posten. Prøv igjen."));
			}
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const isDirty = useStore(form.store, (state) => state.isDirty);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

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
					<p className="text-muted-foreground text-xs">{kind.hint}</p>
				</div>
				<form.Field name="subject">
					{(field) => {
						const isInvalid = !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={`${kind.id}-email-subject`}>Emne</FieldLabel>
								<Input
									id={`${kind.id}-email-subject`}
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
								<FieldLabel htmlFor={`${kind.id}-email-text`}>Tekst</FieldLabel>
								<Textarea
									id={`${kind.id}-email-text`}
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
							form.setFieldValue("subject", kind.defaults.subject);
							form.setFieldValue("text", kind.defaults.text);
						}}
					>
						Bruk standardteksten
					</Button>
				</div>
			</fieldset>

			<EmailPreview kind={kind} value={values} />
		</form>
	);
}

/**
 * The whole email as the company gets it, logo and signature included. The backend renders it from
 * the same template that sends it, once typing pauses.
 */
function EmailPreview({ kind, value }: Readonly<{ kind: EmailKind; value: EmailTemplate }>) {
	const previewEmail = useAction(api.semesterPlanning.semesters.emailPreview.previewCompanyEmail);
	const [preview, setPreview] = useState<{ subject: string; html: string }>();
	const { subject, text } = value;

	useEffect(() => {
		let current = true;
		const timer = setTimeout(() => {
			previewEmail({ kind: kind.id, subject, text }).then(
				(rendered) => {
					if (current) setPreview(rendered);
				},
				// A text the form refuses keeps the last preview; the form shows why.
				() => undefined,
			);
		}, PREVIEW_DELAY_MS);
		return () => {
			current = false;
			clearTimeout(timer);
		};
	}, [previewEmail, kind.id, subject, text]);

	return (
		<section aria-label="Forhåndsvisning" className="min-w-0 rounded-lg border bg-muted/40 p-4">
			<p className="text-muted-foreground text-xs">
				Forhåndsvisning for {EMAIL_PREVIEW.companyName}
			</p>
			<p className="mt-1 min-h-5 font-semibold text-sm">{preview?.subject}</p>
			{preview ? (
				<iframe
					title="Forhåndsvisning av e-posten"
					srcDoc={preview.html}
					sandbox=""
					className="mt-3 h-[36rem] w-full rounded-md border bg-white"
				/>
			) : (
				<output className="mt-3 block text-muted-foreground text-sm">
					Lager forhåndsvisning …
				</output>
			)}
		</section>
	);
}
