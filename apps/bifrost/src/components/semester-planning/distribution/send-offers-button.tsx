"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import {
	AlertDialog,
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
import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { shortDayTitle } from "../format";

/**
 * «Send tilbud til N tildelt»: sends an offer for every application that has a date and is
 * waiting for one, one at a time, with progress in the button. Each company gets the offer link
 * by email. A failure is reported with the backend's message and does not stop the rest.
 */
export function SendOffersButton({
	applications,
}: Readonly<{ applications: readonly Doc<"companyApplications">[] }>) {
	const sendOffer = useMutation(api.semesterPlanning.offers.mutations.sendOffer);
	const [confirming, setConfirming] = useState(false);
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

	const sendAll = async () => {
		const batch = applications.filter((application) => application.assignedDate);
		const total = batch.length;
		setConfirming(false);
		setProgress({ done: 0, total });

		let sent = 0;
		for (const [index, application] of batch.entries()) {
			try {
				await sendOffer({ applicationId: application._id });
				sent += 1;
			} catch (error) {
				toast.error(
					`${application.registry.name}: ${convexErrorMessage(error, "Kunne ikke sende tilbudet.")}`,
				);
			}
			setProgress({ done: index + 1, total });
		}

		setProgress(null);
		if (sent > 0) toast.success(`${sent} tilbud sendes på e-post.`);
	};

	const count = applications.length;
	return (
		<AlertDialog open={confirming} onOpenChange={setConfirming}>
			<AlertDialogTrigger asChild>
				<Button variant="outline" disabled={count === 0 || progress !== null}>
					<Send aria-hidden />
					{progress
						? `Sender ${progress.done} av ${progress.total}`
						: `Send tilbud til ${count} tildelt`}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Sende tilbud til {count} {count === 1 ? "bedrift" : "bedrifter"}?
					</AlertDialogTitle>
					<AlertDialogDescription>
						Hver bedrift får en e-post med en lenke der de godtar datoen, ber om en annen eller
						takker nei. Et tidligere tilbud slutter å virke.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<ul className="max-h-60 divide-y overflow-y-auto rounded-md border text-sm">
					{applications.map((application) => (
						<li key={application._id} className="flex justify-between gap-3 px-3 py-2">
							<span className="truncate font-medium">{application.registry.name}</span>
							<span className="shrink-0 text-muted-foreground tabular-nums">
								{application.assignedDate && shortDayTitle(application.assignedDate)}
							</span>
						</li>
					))}
				</ul>
				<AlertDialogFooter>
					<AlertDialogCancel>Avbryt</AlertDialogCancel>
					<Button onClick={sendAll}>
						<Send aria-hidden />
						Send {count} tilbud
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
