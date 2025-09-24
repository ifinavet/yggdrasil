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
}: {
	eventId: Id<"events">;
	registrationId: Id<"registrations">;
}) {
	const posthog = usePostHog();

	const unregister = useMutation(api.registration.unregister);
	const onUnregister = () =>
		unregister({ id: registrationId })
			.then(({ deletedRegistration, event }) =>
				posthog.capture("midgard-student_unregister", { deletedRegistration, event }),
			)
			.catch(() => {
				toast.error("O! Noe gikk galt! Prøv igjen senere");
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
						Dersom du melder deg av og det er folk på venteliste, vil miste din plass og havne på
						venteliste dersom du melder deg opp på nytt. NB! Melder du det av under 24 timer før
						arrangementet vil du få en prikk.
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
