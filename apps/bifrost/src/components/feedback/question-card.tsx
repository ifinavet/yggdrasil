"use client";

import type { FeedbackField } from "@workspace/shared/feedback";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { SegmentedControl, SegmentedControlItem } from "@workspace/ui/components/segmented-control";
import { Switch } from "@workspace/ui/components/switch";
import { cn } from "@workspace/ui/lib/utils";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	CopyIcon,
	GripVerticalIcon,
	PlusIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { type DragEvent, type ReactNode, useState } from "react";
import {
	addOption,
	changeQuestionType,
	maxOptions,
	minOptions,
	type QuestionType,
	questionTypeLabels,
	removeOption,
} from "./question-edits";

type QuestionCardProps = Readonly<{
	question: FeedbackField;
	index: number;
	isOpen: boolean;
	readOnly: boolean;
	onToggle: () => void;
	onChange?: (question: FeedbackField) => void;
	onDuplicate?: () => void;
	onRemove?: () => void;
	onDragStart?: (event: DragEvent) => void;
	onDragOver?: (event: DragEvent) => void;
	onDrop?: (event: DragEvent) => void;
	onDragEnd?: () => void;
	onMove?: (direction: -1 | 1) => void;
	isDragging?: boolean;
}>;

const labelClass = "font-medium text-muted-foreground text-xs";
const inputClass = "bg-background";

export function QuestionCard({
	question,
	index,
	isOpen,
	readOnly,
	onToggle,
	onChange,
	onDuplicate,
	onRemove,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
	onMove,
	isDragging,
}: QuestionCardProps) {
	const update = (change: Partial<FeedbackField>) => onChange?.({ ...question, ...change });
	const idPrefix = `${readOnly ? "version" : "draft"}-${question.key}`;
	const ChevronIcon = isOpen ? ChevronUpIcon : ChevronDownIcon;
	return (
		<li
			data-question-card
			onDragOver={onDragOver}
			onDrop={onDrop}
			className={cn(
				"group rounded-lg border bg-card transition-colors",
				isOpen ? "border-primary" : "hover:border-primary/35",
				isDragging && "opacity-50",
			)}
		>
			<div className="flex items-center">
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={isOpen}
					className="flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 py-3.5 pl-4 text-left"
				>
					<span className="w-5 shrink-0 text-muted-foreground text-sm tabular-nums">
						{index + 1}.
					</span>
					<span
						className={cn(
							"min-w-0 flex-1 truncate text-[.9rem]",
							!question.label && "text-muted-foreground",
						)}
					>
						{question.label || "Nytt spørsmål"}
					</span>
					{!question.required && <Badge variant="muted">Valgfritt</Badge>}
					<ChevronIcon className="size-4 shrink-0 text-muted-foreground" />
				</button>
				{readOnly ? (
					<span className="w-4" />
				) : (
					<button
						type="button"
						draggable
						onDragStart={onDragStart}
						onDragEnd={onDragEnd}
						onKeyDown={(event) => {
							if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
							event.preventDefault();
							onMove?.(event.key === "ArrowUp" ? -1 : 1);
						}}
						aria-label={`Flytt spørsmål ${index + 1}. Dra, eller bruk piltastene.`}
						className="cursor-grab px-3.5 py-3.5 text-muted-foreground opacity-0 outline-none transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
					>
						<GripVerticalIcon className="size-4" />
					</button>
				)}
			</div>
			{isOpen && (
				<fieldset disabled={readOnly} className="flex flex-col gap-4 pr-4 pb-4 pl-12">
					<Labelled label="Spørsmål" htmlFor={`${idPrefix}-label`}>
						<Input
							id={`${idPrefix}-label`}
							className={inputClass}
							value={question.label}
							placeholder="Skriv spørsmålet"
							onChange={(event) => update({ label: event.target.value })}
						/>
					</Labelled>
					<div className="flex flex-wrap items-center justify-between gap-4">
						<SegmentedControl
							aria-label="Svartype"
							value={question.type}
							disabled={readOnly}
							onValueChange={(type) =>
								onChange?.(changeQuestionType(question, type as QuestionType))
							}
						>
							{Object.entries(questionTypeLabels).map(([type, label]) => (
								<SegmentedControlItem key={type} value={type}>
									{label}
								</SegmentedControlItem>
							))}
						</SegmentedControl>
						<Field orientation="horizontal" className="w-auto">
							<Switch
								id={`${idPrefix}-required`}
								checked={question.required}
								onCheckedChange={(required) => update({ required })}
							/>
							<FieldLabel htmlFor={`${idPrefix}-required`} className="font-normal">
								Påkrevd
							</FieldLabel>
						</Field>
					</div>
					<QuestionTypeDetails
						question={question}
						idPrefix={idPrefix}
						readOnly={readOnly}
						onChange={(changed) => onChange?.(changed)}
					/>
					{!readOnly && (
						<div className="flex items-center justify-end gap-1 border-t pt-3">
							<Button type="button" variant="ghost" onClick={onDuplicate}>
								<CopyIcon />
								Dupliser
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="text-destructive hover:bg-destructive/10 hover:text-destructive"
								onClick={onRemove}
							>
								<Trash2Icon />
								Slett
							</Button>
						</div>
					)}
				</fieldset>
			)}
		</li>
	);
}

function QuestionTypeDetails({
	question,
	idPrefix,
	readOnly,
	onChange,
}: Readonly<{
	question: FeedbackField;
	idPrefix: string;
	readOnly: boolean;
	onChange: (question: FeedbackField) => void;
}>) {
	switch (question.type) {
		case "rating":
			return (
				<div className="grid grid-cols-2 gap-3">
					<Labelled label="Tekst ved 1" htmlFor={`${idPrefix}-low`}>
						<Input
							id={`${idPrefix}-low`}
							className={inputClass}
							value={question.low ?? ""}
							onChange={(event) => onChange({ ...question, low: event.target.value })}
						/>
					</Labelled>
					<Labelled label="Tekst ved 5" htmlFor={`${idPrefix}-high`}>
						<Input
							id={`${idPrefix}-high`}
							className={inputClass}
							value={question.high ?? ""}
							onChange={(event) => onChange({ ...question, high: event.target.value })}
						/>
					</Labelled>
				</div>
			);
		case "text":
			return (
				<Labelled label="Plassholder" htmlFor={`${idPrefix}-placeholder`}>
					<Input
						id={`${idPrefix}-placeholder`}
						className={inputClass}
						value={question.placeholder ?? ""}
						placeholder="Skriv svaret ditt her"
						onChange={(event) => onChange({ ...question, placeholder: event.target.value })}
					/>
				</Labelled>
			);
		case "options":
			return (
				<OptionsEditor
					question={question}
					idPrefix={idPrefix}
					readOnly={readOnly}
					onChange={onChange}
				/>
			);
		case "yesNo":
			return null;
	}
}

function Labelled({
	label,
	htmlFor,
	children,
}: Readonly<{ label: string; htmlFor: string; children: ReactNode }>) {
	return (
		<Field className="gap-1.5">
			<FieldLabel htmlFor={htmlFor} className={labelClass}>
				{label}
			</FieldLabel>
			{children}
		</Field>
	);
}

function OptionsEditor({
	question,
	idPrefix,
	readOnly,
	onChange,
}: Readonly<{
	question: FeedbackField;
	idPrefix: string;
	readOnly: boolean;
	onChange: (question: FeedbackField) => void;
}>) {
	const options = question.options ?? [];
	const [optionIds, setOptionIds] = useState(() => options.map(() => crypto.randomUUID()));
	const ids = options.map((_, position) => optionIds[position] ?? `${idPrefix}-option-${position}`);
	return (
		<div className="flex flex-col gap-2">
			<span className={labelClass}>Alternativer</span>
			{options.map((option, optionIndex) => (
				<div key={ids[optionIndex]} className="flex items-center gap-2.5">
					<Checkbox disabled aria-hidden tabIndex={-1} className="disabled:opacity-60" />
					<Input
						className={inputClass}
						value={option}
						aria-label={`Alternativ ${optionIndex + 1}`}
						onChange={(event) =>
							onChange({
								...question,
								options: options.map((current, position) =>
									position === optionIndex ? event.target.value : current,
								),
							})
						}
					/>
					{!readOnly && options.length > minOptions && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="text-muted-foreground"
							aria-label={`Fjern alternativ ${optionIndex + 1}`}
							onClick={() => {
								setOptionIds(ids.filter((_, position) => position !== optionIndex));
								onChange(removeOption(question, optionIndex));
							}}
						>
							<XIcon />
						</Button>
					)}
				</div>
			))}
			{!readOnly && (
				<Button
					type="button"
					variant="ghost"
					className="self-start"
					disabled={options.length >= maxOptions}
					onClick={() => {
						setOptionIds([...ids, crypto.randomUUID()]);
						onChange(addOption(question));
					}}
				>
					<PlusIcon />
					Legg til alternativ
				</Button>
			)}
			<Field orientation="horizontal" className="mt-1">
				<Switch
					id={`${idPrefix}-allow-other`}
					checked={question.allowOther ?? false}
					onCheckedChange={(allowOther) => onChange({ ...question, allowOther })}
				/>
				<FieldLabel htmlFor={`${idPrefix}-allow-other`} className="font-normal">
					Tillat annet
				</FieldLabel>
			</Field>
		</div>
	);
}
