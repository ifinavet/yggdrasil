"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
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
import { toast } from "sonner";

export function CreateReportNowButton({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const close = useMutation(api.feedback.events.closeEventFeedback);

	const createReport = async () => {
		try {
			await close({ eventId });
			toast.success("Rapporten lages nå.");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke lage rapporten."));
		}
	};

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button size="sm" variant="outline" className="self-start">
					Lag rapport nå
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Lage rapporten nå?</AlertDialogTitle>
					<AlertDialogDescription>
						Skjemaet tar ikke imot flere svar, og påminnelsene som gjenstår sendes ikke. Rapporten
						blir klar til gjennomgang her før den sendes til bedriften.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Vent</AlertDialogCancel>
					<AlertDialogAction onClick={createReport}>Lag rapport nå</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
