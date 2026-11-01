"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { MAX_HELPERS, MAX_INTERNAL_NOTES_LENGTH } from "@workspace/shared/semester/limits";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation } from "convex/react";
import { z } from "zod";
import InternalMemberSelect from "@/components/common/forms/internal-member-select";
import { type Application, useRunMutation } from "./model";

const note = z
	.string()
	.max(MAX_INTERNAL_NOTES_LENGTH, `Notatene kan ha høyst ${MAX_INTERNAL_NOTES_LENGTH} tegn.`);
const notesSchema = z.object({ food: note, room: note, internalNotes: note });
type NoteField = keyof z.infer<typeof notesSchema>;

const NOTE_FIELDS: { name: NoteField; label: string; rows: number }[] = [
	{ name: "food", label: "Mat", rows: 2 },
	{ name: "room", label: "Rom", rows: 2 },
	{ name: "internalNotes", label: "Interne notater", rows: 3 },
];

/**
 * «Ansvarlige fra Navet»: who from Navet runs the event, and notes for them. The choices save at once, and
 * the notes when you leave them. Once the event exists, a change here changes its organizers too,
 * and a change on the event shows here.
 */
export function PlanningCard({ application }: Readonly<{ application: Application }>) {
	const update = useMutation(api.semesterPlanning.applications.mutations.updatePlanningDetails);
	const { pending, run } = useRunMutation();
	const save = (changes: Omit<Parameters<typeof update>[0], "applicationId">) =>
		run(() => update({ applicationId: application._id, ...changes }));

	const helpers = application.helperUserIds ?? [];
	const team = [application.responsibleUserId, application.orgResponsibleUserId, ...helpers];
	const others = (userId: Id<"users"> | undefined) =>
		new Set(team.filter((member): member is Id<"users"> => !!member && member !== userId));
	const saved = {
		food: application.food ?? "",
		room: application.room ?? "",
		internalNotes: application.internalNotes ?? "",
	};
	const form = useForm({ defaultValues: saved, validators: { onChange: notesSchema } });
	const saveNote = (name: NoteField) => {
		const value = form.getFieldValue(name);
		if (value.trim() === saved[name].trim() || !form.getFieldMeta(name)?.isValid) return;
		void save({ [name]: value });
	};

	return (
		<Panel title="Ansvarlige fra Navet">
			<PanelBody>
				<div className="grid gap-3">
					<TeamMember
						id="planning-responsible"
						label="Kontaktperson fra Navet"
						clearLabel="Ingen kontaktperson"
						value={application.responsibleUserId}
						exclude={others(application.responsibleUserId)}
						disabled={pending}
						onChange={(responsibleUserId) => save({ responsibleUserId })}
					/>
					<TeamMember
						id="planning-org-responsible"
						label="Org-ansvarlig"
						clearLabel="Ingen org-ansvarlig"
						value={application.orgResponsibleUserId}
						exclude={others(application.orgResponsibleUserId)}
						disabled={pending}
						onChange={(orgResponsibleUserId) => save({ orgResponsibleUserId })}
					/>
					{Array.from({ length: Math.max(MAX_HELPERS, helpers.length) }, (_, slot) => (
						<TeamMember
							// The slots are fixed positions, so the slot number is a stable key.
							key={slot}
							id={`planning-helper-${slot}`}
							label={`Medhjelper ${slot + 1}`}
							clearLabel="Ingen medhjelper"
							value={helpers[slot]}
							exclude={others(helpers[slot])}
							disabled={pending || (slot > 0 && helpers.length < slot)}
							onChange={(userId) => {
								const next = [...helpers];
								if (userId) next[slot] = userId;
								else next.splice(slot, 1);
								void save({ helperUserIds: next });
							}}
						/>
					))}
					{NOTE_FIELDS.map(({ name, label, rows }) => (
						<form.Field key={name} name={name}>
							{(field) => {
								const isInvalid = !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid} className="gap-1.5">
										<FieldLabel htmlFor={`planning-${name}`}>{label}</FieldLabel>
										<Textarea
											id={`planning-${name}`}
											value={field.state.value}
											rows={rows}
											onChange={(event) => field.handleChange(event.target.value)}
											onBlur={() => {
												field.handleBlur();
												saveNote(name);
											}}
											aria-invalid={isInvalid}
										/>
										{isInvalid && (
											<FieldError className="font-medium" errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>
					))}
				</div>
			</PanelBody>
		</Panel>
	);
}

/** One place in the Navet team: a labelled member select that can be cleared. */
function TeamMember({
	id,
	label,
	clearLabel,
	value,
	exclude,
	disabled,
	onChange,
}: Readonly<{
	id: string;
	label: string;
	clearLabel: string;
	value: Id<"users"> | undefined;
	exclude: ReadonlySet<string>;
	disabled: boolean;
	onChange: (userId: Id<"users"> | null) => void;
}>) {
	return (
		<Field className="gap-1.5">
			<FieldLabel id={`${id}-label`}>{label}</FieldLabel>
			<InternalMemberSelect
				labelId={`${id}-label`}
				value={value ?? null}
				exclude={exclude}
				clearLabel={clearLabel}
				disabled={disabled}
				className="sm:w-full"
				onChange={onChange}
				onClear={() => onChange(null)}
			/>
		</Field>
	);
}
