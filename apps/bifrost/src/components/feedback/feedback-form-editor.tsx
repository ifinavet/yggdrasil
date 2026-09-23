"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { type FeedbackField, feedbackFormSchema } from "@workspace/shared/feedback";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { toast } from "sonner";
import { FeedbackQuestionsEditor } from "./feedback-questions-editor";

export function FeedbackFormEditor({
	formId,
	initialValues,
	onSaved,
}: {
	formId?: Id<"feedbackForms">;
	initialValues: { name: string; fields: FeedbackField[] };
	onSaved: (formId: Id<"feedbackForms">) => void;
}) {
	const saveDraft = useMutation(api.feedback.forms.mutations.saveDraft);
	const publish = useMutation(api.feedback.forms.mutations.publish);
	const [savedFormId, setSavedFormId] = useState(formId);
	const [saveError, setSaveError] = useState<string>();
	const form = useForm({
		defaultValues: initialValues,
		validators: { onSubmit: feedbackFormSchema },
		onSubmitMeta: { publish: false },
		onSubmit: async ({ value, meta }) => {
			setSaveError(undefined);
			try {
				// Persist the draft first so a failed publication does not lose the administrator's changes.
				const updatedFormId = await saveDraft({ formId: savedFormId, ...value });
				setSavedFormId(updatedFormId);
				if (meta.publish) await publish({ formId: updatedFormId });
				toast.success(meta.publish ? "Ny skjemaversjon publisert" : "Utkast lagret");
				onSaved(updatedFormId);
			} catch (error) {
				setSaveError(
					error instanceof ConvexError
						? String(error.data)
						: "Kunne ikke lagre skjemaet. Prøv igjen.",
				);
			}
		},
	});
	return (
		<form
			className="min-w-0 space-y-6"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => (
					<fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
						<form.Field name="name">
							{(field) => (
								<Field>
									<FieldLabel htmlFor="form-name">Skjemanavn</FieldLabel>
									<Input
										id="form-name"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							)}
						</form.Field>
						<form.Field name="fields" mode="array">
							{(field) => (
								<>
									<FeedbackQuestionsEditor
										fields={field.state.value}
										onChange={field.handleChange}
									/>
									<FieldError errors={field.state.meta.errors} />
								</>
							)}
						</form.Field>
						{saveError && (
							<p role="alert" className="text-destructive text-sm">
								{saveError}
							</p>
						)}
						<p className="text-muted-foreground text-sm">
							Publisering lager en ny versjon. Innsamlinger som allerede er opprettet, beholder sine
							spørsmål. Publisering sender ingen e-post.
						</p>
						<div className="flex flex-wrap gap-2">
							<Button type="submit" variant="outline">
								{isSubmitting ? "Lagrer …" : "Lagre utkast"}
							</Button>
							<Button type="button" onClick={() => void form.handleSubmit({ publish: true })}>
								Publiser versjon
							</Button>
						</div>
					</fieldset>
				)}
			</form.Subscribe>
		</form>
	);
}
