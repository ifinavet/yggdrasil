"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { defaultFeedbackFields } from "@workspace/shared/feedback";
import { formatOsloDate } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { useFeatureEnabled } from "@workspace/ui/components/feature-gate";
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
import { EyeIcon, EyeOffIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { FeedbackFormEditor } from "./feedback-form-editor";
import { JobListingOrderSettingsPanel } from "./job-listing-order-settings";
import { QuestionCard } from "./question-card";

type FeedbackFormSummary = FunctionReturnType<
	typeof api.feedback.forms.queries.getFeedbackForms
>["page"][number];

type FormsTab = "feedback" | "jobListing";

const newFormName = "Nytt skjema";
const draftVersion = "draft";

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
	const [tab, setTab] = useState<FormsTab>("feedback");
	const jobListingOrdersEnabled = useFeatureEnabled("jobListingOrders");
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
			toast.error(convexErrorMessage(error, "Kunne ikke opprette skjemaet."));
		} finally {
			setCreating(false);
		}
	}

	return (
		<div className="-m-4 flex min-h-[calc(100svh-4.5rem)]">
			<div className="flex min-w-0 flex-1 flex-col gap-8 px-10 py-10">
				{intro}
				<Tabs value={tab} onValueChange={(value) => setTab(value as FormsTab)}>
					<div className="flex items-end justify-between border-b">
						<TabsList variant="underline" className="border-b-0">
							<TabsTrigger value="feedback">Tilbakemeldinger</TabsTrigger>
							{jobListingOrdersEnabled && (
								<TabsTrigger value="jobListing">Stillingsannonse</TabsTrigger>
							)}
						</TabsList>
						{tab === "feedback" && (
							<Button className="mb-2" disabled={creating} onClick={() => void createForm()}>
								<PlusIcon />
								Nytt skjema
							</Button>
						)}
					</div>
				</Tabs>
				{tab === "jobListing" ? (
					<JobListingOrderSettingsPanel />
				) : (
					<FeedbackFormList
						forms={feedbackForms}
						status={status}
						openFormId={openFormId}
						onSelect={setSelectedFormId}
						onLoadMore={() => loadMore(20)}
					/>
				)}
			</div>
			{tab === "feedback" && (
				<aside className="sticky top-0 flex h-[calc(100svh-4.5rem)] shrink-0 basis-[min(620px,46vw)] flex-col overflow-hidden border-l bg-background">
					{openForm && (
						<FormPanel
							key={openForm._id}
							form={openForm}
							focusName={openForm._id === createdFormId}
						/>
					)}
				</aside>
			)}
		</div>
	);
}

function FeedbackFormList({
	forms: feedbackForms,
	status,
	openFormId,
	onSelect,
	onLoadMore,
}: Readonly<{
	forms: FeedbackFormSummary[];
	status: ReturnType<typeof usePaginatedQuery>["status"];
	openFormId: Id<"feedbackForms"> | undefined;
	onSelect: (formId: Id<"feedbackForms">) => void;
	onLoadMore: () => void;
}>) {
	const setHidden = useMutation(api.feedback.forms.mutations.setHidden);

	async function toggleHidden(form: FeedbackFormSummary) {
		try {
			await setHidden({ formId: form._id, isHidden: !form.isHidden });
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke endre synligheten."));
		}
	}

	return (
		<>
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
							onClick={() => onSelect(feedbackForm._id)}
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
							<span className="text-[13px] text-muted-foreground">{formStatus(feedbackForm)}</span>
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
				<Button variant="outline" className="self-start" onClick={onLoadMore}>
					Hent flere skjemaer
				</Button>
			)}
		</>
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
			renderHeader={(nameInput) => (
				<FormPanelHeader
					nameInput={nameInput}
					form={form}
					versions={versions}
					versionId={versionId}
					onVersionChange={setVersionId}
				/>
			)}
			readOnlyContent={
				selectedVersion && (
					<VersionView versionId={selectedVersion._id} number={selectedVersion.number} />
				)
			}
		/>
	);
}

function FormPanelHeader({
	nameInput,
	form,
	versions,
	versionId,
	onVersionChange,
}: Readonly<{
	nameInput: ReactNode;
	form: FeedbackFormSummary;
	versions: FunctionReturnType<typeof api.feedback.forms.queries.getVersions>;
	versionId: string;
	onVersionChange: (versionId: string) => void;
}>) {
	return (
		<header className="flex items-center justify-between gap-6 border-b px-8 pt-7 pb-5">
			<div className="flex min-w-0 flex-1 items-center gap-2.5">
				{nameInput}
				{!form.isDefault && <SetDefaultButton form={form} />}
			</div>
			<Select value={versionId} onValueChange={onVersionChange}>
				<SelectTrigger aria-label="Versjon" className="shrink-0 bg-card">
					<SelectValue />
				</SelectTrigger>
				<SelectContent align="end">
					<SelectItem value={draftVersion}>Utkast</SelectItem>
					{versions.map((version) => (
						<SelectItem key={version._id} value={version._id}>
							Versjon {version.number}, {formatOsloDate(version.publishedAt, "d. MMM yyyy")}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</header>
	);
}

function setDefaultBlocker(form: FeedbackFormSummary): string | undefined {
	if (form.isHidden) return "Vis skjemaet før det settes som standard.";
	if (!form.publishedVersion) return "Publiser skjemaet før det settes som standard.";
	return undefined;
}

function SetDefaultButton({ form }: Readonly<{ form: FeedbackFormSummary }>) {
	const setDefault = useMutation(api.feedback.forms.mutations.setDefault);
	const [saving, setSaving] = useState(false);
	const blocker = setDefaultBlocker(form);
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
					toast.error(convexErrorMessage(error, "Kunne ikke endre standardskjema."));
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
