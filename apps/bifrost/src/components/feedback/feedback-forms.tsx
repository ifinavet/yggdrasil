"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { defaultFeedbackFields } from "@workspace/shared/feedback";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { toast } from "sonner";
import { FeedbackFormEditor } from "./feedback-form-editor";

export function FeedbackForms() {
	const {
		results: feedbackForms,
		status,
		loadMore,
	} = usePaginatedQuery(api.feedback.forms.queries.getFeedbackForms, {}, { initialNumItems: 20 });
	const [selectedFormId, setSelectedFormId] = useState<Id<"feedbackForms">>();
	const [settingDefault, setSettingDefault] = useState(false);
	const setDefault = useMutation(api.feedback.forms.mutations.setDefault);
	const selectedForm = feedbackForms.find((feedbackForm) => feedbackForm._id === selectedFormId);
	return (
		<div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
			<div className="min-w-0 space-y-3">
				<Button onClick={() => setSelectedFormId(undefined)}>Nytt skjema</Button>
				{status === "LoadingFirstPage" && <output>Henter skjemaer …</output>}
				{feedbackForms.map((feedbackForm) => (
					<button
						type="button"
						key={feedbackForm._id}
						onClick={() => setSelectedFormId(feedbackForm._id)}
						aria-pressed={selectedFormId === feedbackForm._id}
						className="block w-full rounded-lg border p-4 text-left aria-pressed:border-primary aria-pressed:bg-muted"
					>
						<span className="block break-words font-medium">{feedbackForm.name}</span>
						<span className="text-muted-foreground text-sm">
							{feedbackForm.publishedVersion ? "Publisert" : "Utkast"}
							{feedbackForm.isDefault ? <span className="block">Standardskjema</span> : null}
						</span>
					</button>
				))}
				{status === "CanLoadMore" && (
					<Button variant="outline" onClick={() => loadMore(20)}>
						Hent flere skjemaer
					</Button>
				)}
			</div>
			<Card className="min-w-0">
				<CardHeader>
					<CardTitle>{selectedFormId ? "Rediger skjema" : "Nytt tilbakemeldingsskjema"}</CardTitle>
					<CardDescription>
						Standardskjemaet brukes når arrangementet ikke har valgt et eget skjema.
					</CardDescription>
					{selectedForm?.publishedVersion && (
						<Button
							variant="outline"
							disabled={selectedForm.isDefault || settingDefault}
							onClick={async () => {
								setSettingDefault(true);
								try {
									await setDefault({ formId: selectedForm._id });
									toast.success("Standardskjema oppdatert");
								} catch (error) {
									toast.error(
										error instanceof ConvexError
											? String(error.data)
											: "Kunne ikke endre standardskjema.",
									);
								} finally {
									setSettingDefault(false);
								}
							}}
						>
							{selectedForm.isDefault ? "Dette er standardskjemaet" : "Bruk som standardskjema"}
						</Button>
					)}
				</CardHeader>
				<CardContent>
					{selectedFormId ? (
						<ExistingFormEditor
							key={selectedFormId}
							formId={selectedFormId}
							versionId={selectedForm?.publishedVersion?._id}
							onSaved={setSelectedFormId}
						/>
					) : (
						<FeedbackFormEditor
							key="new"
							initialValues={{ name: "", fields: defaultFeedbackFields }}
							onSaved={setSelectedFormId}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
function ExistingFormEditor({
	formId,
	versionId,
	onSaved,
}: Readonly<{
	formId: Id<"feedbackForms">;
	versionId?: Id<"formVersions">;
	onSaved: (formId: Id<"feedbackForms">) => void;
}>) {
	const draft = useQuery(api.feedback.forms.queries.getDraft, { formId });
	const version = useQuery(
		api.feedback.forms.queries.getVersion,
		versionId ? { versionId } : "skip",
	);
	if (!draft || (versionId && !version)) return <output>Henter skjema …</output>;
	const fields =
		draft.draftFields ??
		version?.fields.map(
			({ key, type, label, required, options, allowOther, low, high, placeholder }) => ({
				key,
				type,
				label,
				required,
				options,
				allowOther,
				low,
				high,
				placeholder,
			}),
		) ??
		defaultFeedbackFields;
	return (
		<FeedbackFormEditor
			formId={formId}
			initialValues={{ name: draft.name, fields }}
			onSaved={onSaved}
		/>
	);
}
