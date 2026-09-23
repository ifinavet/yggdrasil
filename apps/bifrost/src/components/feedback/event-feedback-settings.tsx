"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

const settingsSchema = z.object({ enabled: z.boolean(), formId: z.string() });
export function EventFeedbackSettings({ eventId }: { eventId: Id<"events"> }) {
	const settings = useQuery(api.feedback.events.getEventFeedbackSettings, { eventId });
	if (!settings) return <p role="status">Henter innstillinger …</p>;
	return <SettingsForm eventId={eventId} settings={settings} />;
}
function SettingsForm({
	eventId,
	settings,
}: {
	eventId: Id<"events">;
	settings: FunctionReturnType<typeof api.feedback.events.getEventFeedbackSettings>;
}) {
	const saveSettings = useMutation(api.feedback.events.updateEventFeedbackSettings);
	const defaultForm = useQuery(api.feedback.forms.queries.getDefault, {});
	const {
		results: feedbackForms,
		status,
		loadMore,
	} = usePaginatedQuery(api.feedback.forms.queries.getFeedbackForms, {}, { initialNumItems: 20 });
	const [saveError, setSaveError] = useState<string>();
	const form = useForm({
		defaultValues: { enabled: settings.enabled, formId: settings.formId ?? "" },
		validators: { onSubmit: settingsSchema },
		onSubmit: async ({ value }) => {
			setSaveError(undefined);
			try {
				await saveSettings({
					eventId,
					enabled: value.enabled,
					formId: value.formId ? (value.formId as Id<"feedbackForms">) : undefined,
				});
				toast.success("Innstillinger lagret");
			} catch (error) {
				setSaveError(
					error instanceof ConvexError
						? String(error.data)
						: "Kunne ikke lagre innstillingene. Prøv igjen.",
				);
			}
		},
	});
	return (
		<Card className="max-w-3xl">
			<CardHeader>
				<CardTitle>Tilbakemeldinger</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					className="space-y-6"
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<form.Field name="enabled">
						{(field) => (
							<Field orientation="horizontal">
								<Checkbox
									id="feedback-enabled"
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked === true)}
								/>
								<FieldLabel htmlFor="feedback-enabled">
									Tillat tilbakemeldinger for dette arrangementet
								</FieldLabel>
							</Field>
						)}
					</form.Field>
					<form.Field name="formId">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="feedback-form">Tilbakemeldingsskjema</FieldLabel>
								<select
									id="feedback-form"
									className="h-10 w-full rounded-md border bg-background px-3 text-sm"
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
								>
									<option value="">
										{defaultForm?.publishedVersion
											? `Standard: ${defaultForm.publishedVersion.name}`
											: "Standardskjema er ikke valgt"}
									</option>
									{settings.formId &&
										!feedbackForms.some((feedbackForm) => feedbackForm._id === settings.formId) && (
											<option value={settings.formId}>
												{settings.selectedFormName ?? "Valgt skjema"}
											</option>
										)}
									{feedbackForms
										.filter((feedbackForm) => feedbackForm.publishedVersion)
										.map((feedbackForm) => (
											<option key={feedbackForm._id} value={feedbackForm._id}>
												{feedbackForm.name}
											</option>
										))}
								</select>
							</Field>
						)}
					</form.Field>
					{status === "CanLoadMore" && (
						<Button type="button" variant="outline" onClick={() => loadMore(20)}>
							Hent flere skjemaer
						</Button>
					)}
					{saveError && (
						<p role="alert" className="text-destructive text-sm">
							{saveError}
						</p>
					)}
					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Lagrer …" : "Lagre innstillinger"}
							</Button>
						)}
					</form.Subscribe>
				</form>
			</CardContent>
		</Card>
	);
}
