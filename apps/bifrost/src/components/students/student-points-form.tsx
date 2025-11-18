"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
	RadioGroup,
	RadioGroupItem,
} from "@workspace/ui/components/radio-group";
import { useMutation } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import z from "zod/v4";

const pointsSchema = z.object({
	severity: z.number().min(1).max(3),
	reason: z
		.string()
		.min(
			1,
			"Vennligst oppgi en begrunnelse. Det er viktig at vi informerer studenten om hvorfor prikken(e) ble gitt.",
		),
});

export default function StudentPointsForm({
	student_id,
}: Readonly<{
	student_id: Id<"students">;
}>) {
	const posthog = usePostHog();
	const giveStudentPoints = useMutation(api.points.givePoints);

	const form = useForm({
		defaultValues: {
			severity: 1,
			reason: "",
		},
		validators: {
			onSubmit: pointsSchema,
		},
		onSubmit: async ({ value }) => {
			giveStudentPoints({
				id: student_id,
				reason: value.reason,
				severity: value.severity,
			})
				.then(() => {
					toast.success("Prikken(e) ble vellykket gitt");

					posthog.capture("bifrost-student_points_given", {
						student_id: student_id,
						reason: value.reason,
						severity: value.severity,
					});

					form.reset();
				})
				.catch(() => {
					toast.error("Noe gikk galt. Vennligst prøv igjen senere.");
				});
		},
	});

	return (
		<form
			className="space-y-8"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<FieldSet>
				<form.Field name="reason">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Begrunnelse</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
								/>
								<FieldDescription>
									Beskriv hvorfor studenten har fått prikken(e). Denne
									beskrivelsen vil være synlig for studenten.
								</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="severity">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel>Velg antall runder</FieldLabel>
								<RadioGroup
									value={field.state.value.toString()}
									onValueChange={(e) =>
										field.handleChange(Number.parseInt(e, 10))
									}
									defaultValue="1"
									className="grid grid-cols-1 gap-4 md:grid-cols-3"
								>
									<div className="flex h-full items-center space-x-2">
										<Label
											className="flex h-full cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-[state=checked]:border-ring has-data-[state=checked]:bg-primary/5"
											htmlFor="1"
										>
											<RadioGroupItem
												value="1"
												id="1"
												className="data-[state=checked]:border-primary"
											/>
											<div className="grid gap-1 font-normal">
												<div className="font-medium">1 prikk</div>
												<div className="text-balance pr-2 text-muted-foreground text-xs leading-snug">
													Mindre forseelser, gis automatisk ved sen avmelding.
												</div>
											</div>
										</Label>
									</div>
									<div className="flex h-full items-center space-x-2">
										<Label
											className="flex h-full cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-[state=checked]:border-ring has-data-[state=checked]:bg-primary/5"
											htmlFor="2"
										>
											<RadioGroupItem
												value="2"
												id="2"
												className="data-[state=checked]:border-primary"
											/>
											<div className="grid gap-1 font-normal">
												<div className="font-medium">2 prikker</div>
												<div className="text-balance pr-2 text-muted-foreground text-xs leading-snug">
													Større brudd på retningslinjer
												</div>
											</div>
										</Label>
									</div>
									<div className="flex h-full items-center space-x-2">
										<Label
											className="flex h-full cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-[state=checked]:border-ring has-data-[state=checked]:bg-primary/5"
											htmlFor="3"
										>
											<RadioGroupItem
												value="3"
												id="3"
												className="data-[state=checked]:border-primary"
											/>
											<div className="grid gap-1 font-normal">
												<div className="font-medium">3 prikker</div>
												<div className="text-balance pr-2 text-muted-foreground text-xs leading-snug">
													Alvorlige brudd, vil medføre påmeldingsnekt.
												</div>
											</div>
										</Label>
									</div>
								</RadioGroup>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
			</FieldSet>

			<Button type="submit" className="mt-4" disabled={form.state.isSubmitting}>
				{form.state.isSubmitting ? "Sender..." : "Send inn"}
			</Button>
		</form>
	);
}
