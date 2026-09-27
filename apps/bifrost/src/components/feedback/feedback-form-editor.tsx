"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { type FeedbackField, feedbackFormSchema } from "@workspace/shared/feedback";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { useMutation } from "convex/react";
import { PlusIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { QuestionCard } from "./question-card";
import { createQuestion, duplicateQuestion, maxQuestions, moveQuestion } from "./question-edits";

const autosaveDelayMs = 800;

type DraftValues = { name: string; fields: FeedbackField[] };
type SaveState = "saved" | "pending" | "saving" | "failed";

export function FeedbackFormEditor({
	formId,
	initialValues,
	hasDraft,
	focusName,
	renderHeader,
	readOnlyContent,
}: Readonly<{
	formId: Id<"feedbackForms">;
	initialValues: DraftValues;
	hasDraft: boolean;
	focusName: boolean;
	renderHeader: (nameInput: ReactNode) => ReactNode;
	readOnlyContent?: ReactNode;
}>) {
	const saveDraft = useMutation(api.feedback.forms.mutations.saveDraft);
	const publish = useMutation(api.feedback.forms.mutations.publish);
	const [saveState, setSaveState] = useState<SaveState>("saved");
	const [publishing, setPublishing] = useState(false);
	const [openKey, setOpenKey] = useState<string>();
	const [focusKey, setFocusKey] = useState<string>();
	const [dragIndex, setDragIndex] = useState<number>();
	const lastSaved = useRef(JSON.stringify(initialValues));
	const autosaveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
	const nameInput = useRef<HTMLInputElement>(null);
	const form = useForm({ defaultValues: initialValues });
	const values = useStore(form.store, (state) => state.values);
	const validation = feedbackFormSchema.safeParse(values);
	const serialized = JSON.stringify(values);
	const isDirty = serialized !== lastSaved.current;

	const save = useCallback(
		async (draft: DraftValues, snapshot: string) => {
			setSaveState("saving");
			try {
				await saveDraft({ formId, ...draft });
				lastSaved.current = snapshot;
				setSaveState("saved");
			} catch (error) {
				setSaveState("failed");
				toast.error(convexErrorMessage(error, "Kunne ikke lagre utkastet. Prøv igjen."));
			}
		},
		[formId, saveDraft],
	);

	useEffect(() => {
		if (serialized === lastSaved.current) return;
		const parsed = feedbackFormSchema.safeParse(JSON.parse(serialized));
		if (!parsed.success) return;
		setSaveState("pending");
		autosaveTimeout.current = setTimeout(() => void save(parsed.data, serialized), autosaveDelayMs);
		return () => clearTimeout(autosaveTimeout.current);
	}, [serialized, save]);

	useEffect(() => {
		if (!focusName) return;
		nameInput.current?.focus();
		nameInput.current?.select();
	}, [focusName]);

	useEffect(() => {
		if (focusKey) document.getElementById(`draft-${focusKey}-label`)?.focus();
	}, [focusKey]);

	async function publishDraft() {
		if (!validation.success) return;
		clearTimeout(autosaveTimeout.current);
		setPublishing(true);
		try {
			if (isDirty) await saveDraft({ formId, ...validation.data });
			lastSaved.current = serialized;
			setSaveState("saved");
			await publish({ formId });
			toast.success("Ny versjon publisert");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke publisere skjemaet. Prøv igjen."));
		} finally {
			setPublishing(false);
		}
	}

	const setFields = (fields: FeedbackField[]) => form.setFieldValue("fields", fields);
	const fields = values.fields;
	const canPublish =
		(hasDraft || isDirty) && validation.success && !publishing && saveState !== "saving";

	return (
		<>
			{renderHeader(
				<input
					ref={nameInput}
					aria-label="Skjemanavn"
					value={values.name}
					onChange={(event) => form.setFieldValue("name", event.target.value)}
					className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-semibold text-lg tracking-[-0.01em] outline-none hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/15"
				/>,
			)}
			{readOnlyContent ?? (
				<>
					<section className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-8 py-6">
						<ol className="flex flex-col gap-2">
							{fields.map((question, index) => (
								<QuestionCard
									key={question.key}
									question={question}
									index={index}
									readOnly={false}
									isOpen={openKey === question.key}
									isDragging={dragIndex === index}
									onToggle={() => setOpenKey(openKey === question.key ? undefined : question.key)}
									onChange={(changed) =>
										setFields(
											fields.map((current, position) => (position === index ? changed : current)),
										)
									}
									onDuplicate={() => {
										const duplicated = duplicateQuestion(fields, index);
										setFields(duplicated);
										setOpenKey(duplicated[index + 1]?.key);
									}}
									onRemove={() => {
										setFields(fields.filter((current) => current.key !== question.key));
										setOpenKey(undefined);
									}}
									onMove={(direction) => setFields(moveQuestion(fields, index, index + direction))}
									onDragStart={(event) => {
										setDragIndex(index);
										event.dataTransfer.effectAllowed = "move";
										const card = event.currentTarget.closest("[data-question-card]");
										if (card) event.dataTransfer.setDragImage(card, 24, 24);
									}}
									onDragOver={(event) => {
										if (dragIndex === undefined) return;
										event.preventDefault();
										event.dataTransfer.dropEffect = "move";
									}}
									onDrop={(event) => {
										event.preventDefault();
										if (dragIndex !== undefined) setFields(moveQuestion(fields, dragIndex, index));
										setDragIndex(undefined);
									}}
									onDragEnd={() => setDragIndex(undefined)}
								/>
							))}
						</ol>
						<Button
							type="button"
							variant="ghost"
							className="mt-1 self-start"
							disabled={fields.length >= maxQuestions}
							onClick={() => {
								const question = createQuestion();
								setFields([...fields, question]);
								setOpenKey(question.key);
								setFocusKey(question.key);
							}}
						>
							<PlusIcon />
							Legg til spørsmål
						</Button>
					</section>
					<footer className="flex items-center justify-end gap-4 border-t px-8 py-4">
						<output className="mr-auto min-w-0 text-muted-foreground text-sm">
							{validation.success ? (
								saveStateLabel(saveState, isDirty)
							) : (
								<span className="text-destructive">{validation.error.issues[0]?.message}</span>
							)}
						</output>
						<Button type="button" disabled={!canPublish} onClick={() => void publishDraft()}>
							{publishing ? "Publiserer …" : "Publiser ny versjon"}
						</Button>
					</footer>
				</>
			)}
		</>
	);
}

function saveStateLabel(saveState: SaveState, isDirty: boolean) {
	if (saveState === "failed") return "Utkastet ble ikke lagret.";
	if (saveState === "saving" || (isDirty && saveState === "pending")) return "Lagrer …";
	return null;
}
