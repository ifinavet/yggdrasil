"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
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
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { toast } from "sonner";

export default function RegisterForm({
	eventId,
	className,
	waitlist,
	disabled,
}: Readonly<{
	className?: string;
	eventId: Id<"events">;
	waitlist: boolean;
	disabled: boolean;
}>) {
	const [open, setOpen] = useState(false);
	const postHog = usePostHog();

	const signUp = useMutation(api.registration.register);
	const form = useForm({
		defaultValues: {
			notes: "",
		},
		onSubmit: async ({ value }) =>
			signUp({ note: value.notes, eventId })
				.then((status) => {
					if (status === "waitlist" && waitlist === false) {
						toast.warning(
							"Her gikk det unna! Du står nå på ventelisten og vil få en epost dersom det skulle bli en ledig plass til deg",
						);
					}
					postHog.capture("midgard-student_register", {
						eventId,
						status: status,
					});
					setOpen(false);
				})
				.catch(() => {
					toast.error("Oops! Noe gikk galt! Prøv igjen senere.");
				}),
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					className={className}
					type="button"
					onClick={() => setOpen(true)}
					disabled={disabled}
				>
					{waitlist ? "Det er fullt! Meld deg på venteliste" : "Meld deg på"}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:min-w-[50ch] sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Meld meg på</DialogTitle>
					<DialogDescription className="">
						Meld deg på bedriftspresentasjonen! Dersom du har noen algerier
						eller andre ting vi burde vite om, ber vi deg vennligst oppi dem nå.{" "}
						<span className="font-bold">
							NB! Dersom du melder deg på sent, eller blir flyttet fra
							ventelisten sent, så er det ikke sikker at vi kan ta hensyn til
							allergener.
						</span>
					</DialogDescription>
				</DialogHeader>
				<form
					id="registration-form"
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
					<DialogClose asChild>
						<Button variant="outline">Avbryt</Button>
					</DialogClose>
					<Button
						type="submit"
						className="text-primary-foreground"
						form="registration-form"
					>
						Meld meg på {waitlist && "ventelisten"}!
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
