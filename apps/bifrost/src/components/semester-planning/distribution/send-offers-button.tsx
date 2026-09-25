"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { useMutation } from "convex/react";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { convexErrorMessage } from "@/utils/convex-error";
import { shortDayTitle } from "../format";
import { OfferLink, offerEmail, offerUrl } from "../offer-link";

/** An offer made in this batch: the application, the date it offers and the link to send. */
type MadeOffer = {
	application: Doc<"companyApplications">;
	date: string;
	url: string;
};

/**
 * «Lag tilbud til N tildelt»: makes an offer link for every application that has a date and is
 * waiting for one, one at a time, with progress in the button. Nothing is emailed: afterwards it
 * lists the links, each with its email text, for the editor to send by hand. A failure is
 * reported with the backend's message and does not stop the rest.
 */
export function SendOffersButton({
	applications,
}: Readonly<{ applications: readonly Doc<"companyApplications">[] }>) {
	const sendOffer = useMutation(api.semesterPlanning.offers.mutations.sendOffer);
	const [confirming, setConfirming] = useState(false);
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
	const [made, setMade] = useState<MadeOffer[]>([]);

	const makeAll = async () => {
		// Only applications with a date are ready for an offer, and the offer is for that date.
		const batch = applications.flatMap((application) =>
			application.assignedDate ? [{ application, date: application.assignedDate }] : [],
		);
		const total = batch.length;
		setConfirming(false);
		setProgress({ done: 0, total });

		const results: MadeOffer[] = [];
		for (const [index, { application, date }] of batch.entries()) {
			try {
				const { linkToken } = await sendOffer({ applicationId: application._id });
				results.push({ application, date, url: offerUrl(linkToken) });
			} catch (error) {
				toast.error(
					`${application.registry.name}: ${convexErrorMessage(error, "Kunne ikke lage tilbudet.")}`,
				);
			}
			setProgress({ done: index + 1, total });
		}

		setProgress(null);
		setMade(results);
	};

	const count = applications.length;
	return (
		<>
			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogTrigger asChild>
					<Button variant="outline" disabled={count === 0 || progress !== null}>
						<Link2 aria-hidden />
						{progress
							? `Lager ${progress.done} av ${progress.total}`
							: `Lag tilbud til ${count} tildelt`}
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Lage tilbud til {count} {count === 1 ? "bedrift" : "bedrifter"}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Hver bedrift får en lenke der de godtar datoen, ber om en annen eller takker nei. Du
							sender lenkene selv på e-post. Et tidligere tilbud slutter å virke.
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
						<Button onClick={makeAll}>
							<Link2 aria-hidden />
							Lag {count} tilbud
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog open={made.length > 0} onOpenChange={(open) => !open && setMade([])}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>
							{made.length} {made.length === 1 ? "tilbud er klart" : "tilbud er klare"}
						</DialogTitle>
						<DialogDescription>
							Send lenkene til bedriftene på e-post. Du finner dem også på hver søknad.
						</DialogDescription>
					</DialogHeader>
					<ul className="max-h-[60vh] divide-y overflow-y-auto rounded-md border">
						{made.map(({ application, date, url }) => (
							<li key={application._id} className="grid gap-2 px-3 py-3 text-sm">
								<div className="flex justify-between gap-3">
									<span className="truncate font-medium">{application.registry.name}</span>
									<span className="shrink-0 text-muted-foreground tabular-nums">
										{shortDayTitle(date)}
									</span>
								</div>
								<span className="truncate text-muted-foreground text-xs">
									{application.contact.name} · {application.contact.email}
								</span>
								<OfferLink
									url={url}
									email={offerEmail({
										to: application.contact.email,
										contactName: application.contact.name,
										date,
										url,
									})}
								/>
							</li>
						))}
					</ul>
					<DialogFooter>
						<Button variant="outline" onClick={() => setMade([])}>
							Lukk
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
