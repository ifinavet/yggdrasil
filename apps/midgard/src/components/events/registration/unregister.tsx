"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { useMutation } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";

export default function Unregister({
	eventId,
	registrationId,
}: Readonly<{
	eventId: Id<"events">;
	registrationId: Id<"registrations">;
}>) {
	const posthog = usePostHog();

	const unregister = useMutation(api.events.registrations.mutations.unregister);
	const onUnregister = () =>
		unregister({ id: registrationId })
			.then(({ deletedRegistration, event, person }) =>
				posthog.capture("midgard-student_unregister", {
					unregistration_type: "Regular unregistration",
					deletedRegistration,
					event,
					person,
				}),
			)
			.catch(() => {
				toast.error("Oi! Noe gikk galt! Prøv igjen senere");
				posthog.captureException("midgard-student_unregister_error", {
					site: "midgard",
					eventId,
					registrationId,
				});
			});

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button type="button" variant="destructive">
					Meld meg av
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Er du sikker?</AlertDialogTitle>
					<AlertDialogDescription>
						Hvis du melder deg av og andre står på venteliste, mister du plassen din og havner på
						venteliste hvis du melder deg på igjen. NB! Melder du deg av under 24 timer før
						arrangementet, får du en prikk.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Avbryt</AlertDialogCancel>
					<AlertDialogAction onClick={onUnregister} className="text-primary-foreground">
						Jeg er helt sikker, meld meg av.
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
