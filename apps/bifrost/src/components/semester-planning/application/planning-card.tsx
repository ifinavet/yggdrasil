"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { MAX_HELPERS, MAX_INTERNAL_NOTES_LENGTH } from "@workspace/shared/semester/limits";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation } from "convex/react";
import Link from "next/link";
import { z } from "zod";
import InternalMemberSelect from "@/components/common/forms/internal-member-select";
import { type Application, useRunMutation } from "./model";

const notesSchema = z.object({
	internalNotes: z
		.string()
		.max(MAX_INTERNAL_NOTES_LENGTH, `Notatene kan ha høyst ${MAX_INTERNAL_NOTES_LENGTH} tegn.`),
});

/**
 * «Ansvarlige fra Navet»: who from Navet runs the event, and notes for them. The choices save at once, and
 * the notes when you leave them. Once the event exists, its organizers are the team, so the
 * pickers are locked here.
 */
export function PlanningCard({ application }: Readonly<{ application: Application }>) {
	const update = useMutation(api.semesterPlanning.applications.mutations.updatePlanningDetails);
	const { pending, run } = useRunMutation();
	const save = (changes: Omit<Parameters<typeof update>[0], "applicationId">) =>
		run(() => update({ applicationId: application._id, ...changes }));

	const helpers = application.helperUserIds ?? [];
	const savedNotes = application.internalNotes ?? "";
	const form = useForm({
		defaultValues: { internalNotes: savedNotes },
		validators: { onChange: notesSchema },
	});
	const saveNotes = () => {
		const notes = form.getFieldValue("internalNotes");
		if (notes.trim() === savedNotes.trim() || !form.getFieldMeta("internalNotes")?.isValid) return;
		void save({ internalNotes: notes });
	};

	const teamLocked = application.eventId !== undefined;
	return (
		<Panel title="Ansvarlige fra Navet">
			<PanelBody>
				<div className="grid gap-3">
					<TeamMember
						id="planning-responsible"
						label="Kontaktperson fra Navet"
						clearLabel="Ingen kontaktperson"
						value={application.responsibleUserId}
						exclude={new Set(helpers)}
						disabled={pending || teamLocked}
						onChange={(responsibleUserId) => save({ responsibleUserId })}
					/>
					{Array.from({ length: MAX_HELPERS }, (_, slot) => (
						<TeamMember
							// The slots are fixed positions, so the index is a stable key.
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
							key={slot}
							id={`planning-helper-${slot}`}
							label={`Medhjelper ${slot + 1}`}
							clearLabel="Ingen medhjelper"
							value={helpers[slot]}
							exclude={
								new Set([
									...(application.responsibleUserId ? [application.responsibleUserId] : []),
									...helpers.filter((_, index) => index !== slot),
								])
							}
							disabled={pending || teamLocked || (slot > 0 && helpers.length < slot)}
							onChange={(userId) => {
								const next = [...helpers];
								if (userId) next[slot] = userId;
								else next.splice(slot, 1);
								void save({ helperUserIds: next });
							}}
						/>
					))}
					{teamLocked && (
						<p className="text-muted-foreground text-sm">
							Teamet endres på{" "}
							<Link
								href={`/events/${application.eventId}`}
								className="underline underline-offset-3"
							>
								arrangementet
							</Link>
							.
						</p>
					)}

					<form.Field name="internalNotes">
						{(field) => {
							const isInvalid = !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid} className="gap-1.5">
									<FieldLabel htmlFor="planning-notes">Interne notater</FieldLabel>
									<Textarea
										id="planning-notes"
										value={field.state.value}
										rows={3}
										onChange={(event) => field.handleChange(event.target.value)}
										onBlur={() => {
											field.handleBlur();
											saveNotes();
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
