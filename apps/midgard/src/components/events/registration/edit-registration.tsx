"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useMutation } from "convex/react";
import { CalendarPlus } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { toast } from "sonner";
import { humanReadableDateTime } from "@/utils/dateFormatting";
import createCalendarEventIcs from "@/utils/icsCalendarEvent";
import Unregister from "./unregister";

export default function EditRegistration({
	registration,
	disabled,
	event,
}: Readonly<{
	registration: Doc<"registrations">;
	disabled: boolean;
	event: Doc<"events">;
}>) {
	const [open, setOpen] = useState(false);

	const postHog = usePostHog();

	const updateNote = useMutation(api.registration.updateNote);
	const form = useForm({
		defaultValues: {
			notes: registration.note,
		},
		onSubmit: async ({ value }) =>
			updateNote({ id: registration._id, note: value.notes })
				.then(() => {
					toast("Din endring ble lagret", {
						description: humanReadableDateTime(new Date()),
						position: "top-center",
					});
					form.reset({ notes: value.notes });
					setOpen(false);
				})
				.catch(() => {
					toast.error("Oi! Det oppstod en feil! Prøv igjen senere");
				}),
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					className="w-3/4 whitespace-normal text-balance rounded-xl bg-violet-400 py-8 text-lg text-primary-foreground opacity-100! hover:cursor-pointer hover:bg-violet-500 md:w-1/2 dark:bg-violet-300 dark:text-zinc-800"
					onClick={() => setOpen(true)}
					disabled={disabled}
				>
					Rediger din påmelding
				</Button>
			</DialogTrigger>
			<DialogContent aria-description="Rediger påmelding">
				<DialogHeader>
					<DialogTitle>Rediger din påmelding</DialogTitle>
				</DialogHeader>
				<form
					id="update-registration-form"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="notes">
							{(field) => {
								return (
									<Field>
										<FieldContent>
											<FieldLabel>Allergier eller andre merknader</FieldLabel>
											<FieldDescription>
												Har du noen allergier, eller andre merknader?
											</FieldDescription>
										</FieldContent>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="eks. Nøtter"
											autoComplete="off"
										/>
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
				<DialogFooter>
					<div className="flex w-full flex-wrap justify-between gap-2">
						<div>
							<Button
								variant="outline"
								onClick={() => {
									createCalendarEventIcs(
										event.title,
										event.description,
										event.location,
										event.eventStart,
									);

									postHog.capture("midgard_added-event-to-calendar", {
										site: "midgard",
										eventId: event._id,
										eventTitle: event.title,
									});
								}}
							>
								<CalendarPlus />
								Legg til i kalenderen
							</Button>
						</div>
						<div className="flex gap-2">
							<Unregister
								registrationId={registration._id}
								eventId={event._id}
							/>
							<Button
								type="submit"
								form="update-registration-form"
								className="text-primary-foreground"
							>
								Lagre Endringer
							</Button>
						</div>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
