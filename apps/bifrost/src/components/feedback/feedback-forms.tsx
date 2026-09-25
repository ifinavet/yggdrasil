"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { defaultFeedbackFields } from "@workspace/shared/feedback";
import { formatFeedbackDate } from "@workspace/shared/feedback/time";
import { Button } from "@workspace/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { EyeIcon, EyeOffIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { FeedbackFormEditor } from "./feedback-form-editor";
import { QuestionCard } from "./question-card";

type FeedbackFormSummary = FunctionReturnType<
	typeof api.feedback.forms.queries.getFeedbackForms
>["page"][number];

const newFormName = "Nytt skjema";
const draftVersion = "draft";

function errorMessage(error: unknown, fallback: string) {
	return error instanceof ConvexError ? String(error.data) : fallback;
}

function formStatus(form: FeedbackFormSummary) {
	const published = form.publishedVersion && !form.hasDraft;
	if (!form.isDefault) return published ? "Publisert" : "Upublisert";
	return (
		<>
			<span className="font-medium text-primary">Standard</span>,{" "}
			{published ? "publisert" : "upublisert"}
		</>
	);
}

function visibilityHint(form: FeedbackFormSummary) {
	if (form.isDefault) return "Standardskjemaet kan ikke skjules.";
	if (form.isHidden) return "Skjemaet kan ikke velges på arrangementer.";
	return "Et skjult skjema kan ikke velges på arrangementer.";
}

export function FeedbackForms({ intro }: Readonly<{ intro: ReactNode }>) {
	const {
		results: loadedForms,
		status,
		loadMore,
	} = usePaginatedQuery(api.feedback.forms.queries.getFeedbackForms, {}, { initialNumItems: 20 });
	const feedbackForms = [...loadedForms].sort(
		(first, second) => Number(second.isDefault) - Number(first.isDefault),
	);
	const [selectedFormId, setSelectedFormId] = useState<Id<"feedbackForms">>();
	const [createdFormId, setCreatedFormId] = useState<Id<"feedbackForms">>();
	const [creating, setCreating] = useState(false);
	const saveDraft = useMutation(api.feedback.forms.mutations.saveDraft);
	const setHidden = useMutation(api.feedback.forms.mutations.setHidden);
	const openFormId =
		selectedFormId ??
		feedbackForms.find((feedbackForm) => feedbackForm.isDefault)?._id ??
		feedbackForms[0]?._id;
	const openForm = feedbackForms.find((feedbackForm) => feedbackForm._id === openFormId);

	async function createForm() {
		setCreating(true);
		try {
			const formId = await saveDraft({ name: newFormName, fields: defaultFeedbackFields });
			setSelectedFormId(formId);
			setCreatedFormId(formId);
		} catch (error) {
			toast.error(errorMessage(error, "Kunne ikke opprette skjemaet."));
		} finally {
			setCreating(false);
		}
	}

	async function toggleHidden(form: FeedbackFormSummary) {
		try {
			await setHidden({ formId: form._id, isHidden: !form.isHidden });
		} catch (error) {
			toast.error(errorMessage(error, "Kunne ikke endre synligheten."));
		}
	}

	return (
		<div className="-m-4 flex min-h-[calc(100svh-4.5rem)]">
			<div className="flex min-w-0 flex-1 flex-col gap-8 px-10 py-10">
				{intro}
				<Tabs defaultValue="feedback">
					<div className="flex items-end justify-between border-b">
						<TabsList variant="underline" className="border-b-0">
							<TabsTrigger value="feedback">Tilbakemeldinger</TabsTrigger>
						</TabsList>
						<Button className="mb-2" disabled={creating} onClick={() => void createForm()}>
							<PlusIcon />
							Nytt skjema
						</Button>
					</div>
				</Tabs>
				<div className="overflow-hidden rounded-lg border bg-card">
					{status === "LoadingFirstPage" && (
						<output className="block px-5 py-4 text-muted-foreground text-sm">
							Henter skjemaer …
						</output>
					)}
					{feedbackForms.map((feedbackForm) => (
						<div
							key={feedbackForm._id}
							data-open={feedbackForm._id === openFormId}
							className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t pr-5 first:border-t-0 hover:bg-accent/50 data-[open=true]:bg-accent data-[open=true]:shadow-[inset_2px_0_0_var(--primary)]"
						>
							<button
								type="button"
								aria-pressed={feedbackForm._id === openFormId}
								onClick={() => setSelectedFormId(feedbackForm._id)}
								className="flex min-w-0 cursor-pointer flex-col gap-1 py-[1.1rem] pl-5 text-left"
							>
								<span
									className={cn(
										"truncate font-medium",
										feedbackForm.isHidden && "text-muted-foreground",
									)}
								>
									{feedbackForm.name}
								</span>
								<span className="text-[13px] text-muted-foreground">
									{formStatus(feedbackForm)}
								</span>
							</button>
							<Button
								variant="ghost"
								size="icon"
								disabled={feedbackForm.isDefault}
								className="text-muted-foreground"
								onClick={() => void toggleHidden(feedbackForm)}
								aria-label={`${feedbackForm.isHidden ? "Vis" : "Skjul"} ${feedbackForm.name}`}
								aria-describedby={`${feedbackForm._id}-visibility`}
								title={visibilityHint(feedbackForm)}
							>
								{feedbackForm.isHidden ? <EyeOffIcon /> : <EyeIcon />}
							</Button>
							<span id={`${feedbackForm._id}-visibility`} className="sr-only">
								{visibilityHint(feedbackForm)}
							</span>
						</div>
					))}
				</div>
				{status === "CanLoadMore" && (
					<Button variant="outline" className="self-start" onClick={() => loadMore(20)}>
						Hent flere skjemaer
					</Button>
				)}
			</div>
			<aside className="sticky top-0 flex h-[calc(100svh-4.5rem)] shrink-0 basis-[min(620px,46vw)] flex-col overflow-hidden border-l bg-background">
				{openForm && (
					<FormPanel
						key={openForm._id}
						form={openForm}
						focusName={openForm._id === createdFormId}
					/>
				)}
			</aside>
		</div>
	);
}

function FormPanel({
	form,
	focusName,
}: Readonly<{ form: FeedbackFormSummary; focusName: boolean }>) {
	const [versionId, setVersionId] = useState<string>(draftVersion);
	const draft = useQuery(api.feedback.forms.queries.getDraft, { formId: form._id });
	const versions = useQuery(api.feedback.forms.queries.getVersions, { formId: form._id });
	const latestVersion = useQuery(
		api.feedback.forms.queries.getVersion,
		form.publishedVersion ? { versionId: form.publishedVersion._id } : "skip",
	);
	if (!draft || !versions || (form.publishedVersion && !latestVersion))
		return <output className="px-8 py-7 text-muted-foreground text-sm">Henter skjema …</output>;
	const fields =
		draft.draftFields ??
		latestVersion?.fields.map(
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
	const selectedVersion = versions.find((version) => version._id === versionId);

	return (
		<FeedbackFormEditor
			formId={form._id}
			initialValues={{ name: draft.name, fields }}
			hasDraft={form.hasDraft}
			focusName={focusName}
			header={(nameInput) => (
				<header className="flex items-center justify-between gap-6 border-b px-8 pt-7 pb-5">
					<div className="flex min-w-0 flex-1 items-center gap-2.5">
						{nameInput}
						{!form.isDefault && <SetDefaultButton form={form} />}
					</div>
					<Select value={versionId} onValueChange={setVersionId}>
						<SelectTrigger aria-label="Versjon" className="shrink-0 bg-card">
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value={draftVersion}>Utkast</SelectItem>
							{versions.map((version) => (
								<SelectItem key={version._id} value={version._id}>
									Versjon {version.number}, {formatFeedbackDate(version.publishedAt, "d. MMM yyyy")}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</header>
			)}
			readOnlyContent={
				selectedVersion && (
					<VersionView versionId={selectedVersion._id} number={selectedVersion.number} />
				)
			}
		/>
	);
}

function SetDefaultButton({ form }: Readonly<{ form: FeedbackFormSummary }>) {
	const setDefault = useMutation(api.feedback.forms.mutations.setDefault);
	const [saving, setSaving] = useState(false);
	const blocker = form.isHidden
		? "Vis skjemaet før det settes som standard."
		: form.publishedVersion
			? undefined
			: "Publiser skjemaet før det settes som standard.";
	return (
		<Button
			variant="outline"
			className="shrink-0"
			disabled={saving || blocker !== undefined}
			title={blocker}
			onClick={async () => {
				setSaving(true);
				try {
					await setDefault({ formId: form._id });
					toast.success("Standardskjema oppdatert");
				} catch (error) {
					toast.error(errorMessage(error, "Kunne ikke endre standardskjema."));
				} finally {
					setSaving(false);
				}
			}}
		>
			Sett som standard
		</Button>
	);
}

function VersionView({
	versionId,
	number,
}: Readonly<{ versionId: Id<"formVersions">; number: number }>) {
	const version = useQuery(api.feedback.forms.queries.getVersion, { versionId });
	const [openKey, setOpenKey] = useState<string>();
	return (
		<section className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-8 py-6">
			<p className="mb-2 text-muted-foreground text-sm">
				Skrivebeskyttet. Slik så skjemaet ut for dem som fikk versjon {number}.
			</p>
			<ol className="flex flex-col gap-2">
				{version?.fields.map((question, index) => (
					<QuestionCard
						key={question.key}
						question={question}
						index={index}
						readOnly
						isOpen={openKey === question.key}
						onToggle={() => setOpenKey(openKey === question.key ? undefined : question.key)}
					/>
				))}
			</ol>
		</section>
	);
}
