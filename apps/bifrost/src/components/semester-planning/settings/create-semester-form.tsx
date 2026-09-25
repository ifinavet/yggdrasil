"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { semesterName, TERM_LABELS } from "@workspace/shared/semester/labels";
import { MAX_SEMESTER_YEAR, MIN_SEMESTER_YEAR } from "@workspace/shared/semester/limits";
import { nextTermAfter, osloToday, SEMESTER_TERMS } from "@workspace/shared/semester/time";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { convexErrorMessage } from "@/utils/convex-error";

const createSchema = z.object({
	year: z
		.number({ error: "Oppgi et år." })
		.int("Oppgi et helt år.")
		.min(MIN_SEMESTER_YEAR, `Året må være ${MIN_SEMESTER_YEAR} eller senere.`)
		.max(MAX_SEMESTER_YEAR, `Året må være ${MAX_SEMESTER_YEAR} eller tidligere.`),
	term: z.enum(SEMESTER_TERMS),
});

/**
 * Picks the year and term of a new semester and creates it as a draft. It suggests the term after
 * today's, like the rollover job; dates and the deadline are set afterwards by a human.
 */
export function CreateSemesterForm({
	onCreated,
	onCancel,
}: Readonly<{ onCreated: (semesterId: Id<"semesters">) => void; onCancel?: () => void }>) {
	const create = useMutation(api.semesterPlanning.semesters.mutations.create);
	const [saveError, setSaveError] = useState<string>();
	const suggested = nextTermAfter(osloToday(Date.now()));

	const form = useForm({
		defaultValues: { year: suggested.year, term: suggested.term } as z.input<typeof createSchema>,
		validators: { onSubmit: createSchema },
		onSubmit: async ({ value }) => {
			setSaveError(undefined);
			try {
				const semesterId = await create({ year: value.year, term: value.term });
				toast.success(`${semesterName(value.term, value.year)} er opprettet som utkast.`);
				onCreated(semesterId);
			} catch (error) {
				setSaveError(convexErrorMessage(error, "Kunne ikke opprette semesteret. Prøv igjen."));
			}
		},
	});

	return (
		<form
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="term">
					{(field) => (
						<Field>
							<FieldLabel htmlFor="new-semester-term">Semester</FieldLabel>
							<Select
								value={field.state.value}
								onValueChange={(value) => field.handleChange(value as typeof field.state.value)}
							>
								<SelectTrigger id="new-semester-term" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SEMESTER_TERMS.map((term) => (
										<SelectItem key={term} value={term}>
											{TERM_LABELS[term]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
				</form.Field>
				<form.Field name="year">
					{(field) => {
						const isInvalid = !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="new-semester-year">År</FieldLabel>
								<Input
									id="new-semester-year"
									type="number"
									inputMode="numeric"
									min={MIN_SEMESTER_YEAR}
									max={MAX_SEMESTER_YEAR}
									className="tabular-nums"
									value={Number.isNaN(field.state.value) ? "" : field.state.value}
									onChange={(event) => field.handleChange(event.target.valueAsNumber)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
			</div>

			<p className="text-muted-foreground text-sm">
				Semesteret lages som utkast. Informasjonstekst, vilkår og starttid hentes fra forrige
				semester. Datoer og søknadsfrist setter du selv etterpå.
			</p>

			{saveError && (
				<p role="alert" className="font-medium text-destructive text-sm">
					{saveError}
				</p>
			)}

			<div className="flex flex-wrap justify-end gap-2">
				{onCancel && (
					<Button type="button" variant="outline" onClick={onCancel}>
						Avbryt
					</Button>
				)}
				<form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Oppretter …" : "Opprett semester"}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}
