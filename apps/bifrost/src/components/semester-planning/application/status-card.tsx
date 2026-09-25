"use client";

import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { Link2, type LucideIcon } from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { capitalize, formatMoment, longDay, shortDay, shortDayTitle } from "../format";
import { OfferLink, offerEmail, offerUrl } from "../offer-link";
import { isActiveStatus, STATUS_CALLOUT_CLASSES } from "../status";
import { StatusIcon } from "../status-badge";
import { AssignDateDialog, useAssignDate } from "./assign-date-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { actorName } from "./history-card";
import {
	type ApplicationDetails,
	canAssignDate,
	freeDates,
	lastChangeTo,
	latestOffer,
	type SemesterContext,
	useRunMutation,
} from "./model";
import { Section } from "./section";
import { StatusSteps } from "./status-steps";

type Dialog = "assign" | "reject" | "withdraw" | "confirm" | null;

/**
 * The status steps and the callout with what happens next and the buttons for it. Each status
 * has one filled button for the next step; the rest are outline or ghost buttons.
 */
export function StatusCard({
	details,
	context,
	companyName,
}: Readonly<{ details: ApplicationDetails; context: SemesterContext; companyName: string }>) {
	const { application, offers } = details;
	const { status } = application;

	const [dialog, setDialog] = useState<Dialog>(null);

	const sendOffer = useMutation(api.semesterPlanning.offers.mutations.sendOffer);
	const confirmManually = useMutation(api.semesterPlanning.offers.mutations.confirmManually);
	const reject = useMutation(api.semesterPlanning.applications.mutations.reject);
	const withdraw = useMutation(api.semesterPlanning.applications.mutations.withdraw);
	const reopen = useMutation(api.semesterPlanning.applications.mutations.reopen);
	const { pending, run } = useRunMutation();
	const { assign, pending: assigning } = useAssignDate(application, companyName);

	const offer = latestOffer(offers);
	const requestedDates =
		status === "new_date_requested" && offer?.status === "new_date_requested"
			? (offer.requestedDates ?? [])
			: [];

	const canAssign = canAssignDate(application, context.semester);
	// A closed semester refuses new dates and offers, so their buttons are left out.
	const semesterClosed = context.semester.status === "closed";
	const assigned = application.assignedDate;

	const act = (
		label: string,
		onClick: () => void,
		variant: "default" | "outline" | "ghost",
		Icon?: LucideIcon,
	) => (
		<Button
			key={label}
			size="sm"
			variant={variant}
			disabled={pending || assigning}
			onClick={onClick}
		>
			{Icon && <Icon />}
			{label}
		</Button>
	);
	const withdrawButton = act("Trekk", () => setDialog("withdraw"), "ghost");
	const rejectButton = act("Avslå", () => setDialog("reject"), "outline");

	let actions: (ReactNode | false)[];
	switch (status) {
		case "applied":
			actions = assigned
				? [
						!semesterClosed &&
							act(
								"Lag tilbud",
								() =>
									run(
										() => sendOffer({ applicationId: application._id }),
										() => toast.success("Tilbudet er klart. Send lenken til bedriften på e-post."),
									),
								"default",
								Link2,
							),
						!semesterClosed && act("Fjern dato", () => assign(null), "outline"),
						withdrawButton,
					]
				: [
						canAssign && act("Tildel dato", () => setDialog("assign"), "default"),
						rejectButton,
						withdrawButton,
					];
			break;
		case "offer_sent":
			actions = [
				act("Marker som bekreftet", () => setDialog("confirm"), "outline"),
				withdrawButton,
			];
			break;
		case "new_date_requested":
			actions = [
				canAssign && act("Tildel ny dato", () => setDialog("assign"), "default"),
				rejectButton,
				withdrawButton,
			];
			break;
		case "confirmed":
			actions = [
				canAssign && act("Flytt dato", () => setDialog("assign"), "outline"),
				withdrawButton,
			];
			break;
		default:
			actions = [
				act(
					"Gjenåpne",
					() =>
						run(
							() => reopen({ applicationId: application._id }),
							() => toast.success("Søknaden er gjenåpnet som «Søkt»."),
						),
					"outline",
				),
			];
	}

	return (
		<Section>
			<StatusSteps details={details} />

			<div
				className={cn(
					"flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-3 text-[13.5px]",
					STATUS_CALLOUT_CLASSES[status],
				)}
			>
				<StatusIcon status={status} />
				<p className="min-w-0 flex-1 basis-56">
					<StatusMessage
						details={details}
						context={context}
						companyName={companyName}
						requestedDates={requestedDates}
					/>
					{semesterClosed &&
						(status === "applied" || status === "new_date_requested") &&
						" Semesteret er stengt, så datoer og tilbud kan ikke endres."}
				</p>
				<div className="flex flex-wrap gap-2">{actions}</div>
			</div>

			{status === "offer_sent" && offer?.status === "pending" && (
				<PendingOfferLink application={application} offer={offer} />
			)}

			{canAssign && (
				<AssignDateDialog
					open={dialog === "assign"}
					onOpenChange={(open) => setDialog(open ? "assign" : null)}
					application={application}
					companyName={companyName}
					context={context}
					requestedDates={requestedDates}
				/>
			)}

			<ConfirmDialog
				open={dialog === "reject"}
				onOpenChange={(open) => setDialog(open ? "reject" : null)}
				title={`Avslå søknaden fra ${companyName}?`}
				description="Bedriften får ikke e-post om dette. Et tilbud som er sendt, slutter å virke. Du kan gjenåpne søknaden senere."
				comment={{ label: "Kommentar (valgfritt)" }}
				confirmLabel="Avslå søknaden"
				destructive
				onConfirm={(comment) =>
					run(
						() => reject({ applicationId: application._id, comment }),
						() => toast.success("Søknaden er avslått."),
					)
				}
			/>

			<ConfirmDialog
				open={dialog === "withdraw"}
				onOpenChange={(open) => setDialog(open ? "withdraw" : null)}
				title={`Trekke søknaden fra ${companyName}?`}
				description={
					<>
						{assigned && isActiveStatus(status)
							? `${shortDayTitle(assigned)} blir ledig igjen. `
							: ""}
						Lenken i et sendt tilbud slutter å virke, og bedriften får ikke e-post om dette. Du kan
						gjenåpne søknaden senere.
					</>
				}
				comment={{ label: "Kommentar (valgfritt)" }}
				confirmLabel="Trekk søknaden"
				destructive
				onConfirm={(comment) =>
					run(
						() => withdraw({ applicationId: application._id, comment }),
						() =>
							toast.success(
								assigned
									? `Søknaden er trukket. ${shortDay(assigned)} er ledig igjen.`
									: "Søknaden er trukket.",
							),
					)
				}
			/>

			<ConfirmDialog
				open={dialog === "confirm"}
				onOpenChange={(open) => setDialog(open ? "confirm" : null)}
				title="Marker som bekreftet"
				description={[
					"Bruk dette når bedriften har svart ja utenfor lenken, for eksempel på e-post.",
					assigned && `${capitalize(longDay(assigned))} blir bekreftet og låst.`,
				]
					.filter(Boolean)
					.join(" ")}
				comment={{
					label: "Hvordan bekreftet bedriften?",
					requiredMessage: "Skriv hvordan bedriften bekreftet.",
				}}
				confirmLabel="Marker som bekreftet"
				onConfirm={(comment) =>
					run(
						() => confirmManually({ applicationId: application._id, comment: comment ?? "" }),
						() => toast.success("Søknaden er bekreftet manuelt."),
					)
				}
			/>
		</Section>
	);
}

/** The confirmed date, and when the company accepted it (or Navet marked it as confirmed). */
function ConfirmedMessage({
	details,
	confirmedChange,
}: Readonly<{
	details: ApplicationDetails;
	confirmedChange: ReturnType<typeof lastChangeTo>;
}>) {
	const assigned = details.application.assignedDate;
	const date = assigned ? (
		<>
			Bekreftet <b>{longDay(assigned)}</b>
		</>
	) : (
		"Bekreftet"
	);
	if (!confirmedChange) return <>{date}.</>;

	const when = formatMoment(confirmedChange._creationTime, "longDay");
	const how = confirmedChange.actor === "company" ? "godtok" : "markert som bekreftet";
	return (
		<>
			{date}, {how} {when}.
		</>
	);
}

/** The link to the open offer, and the email text to send it with. */
function PendingOfferLink({
	application,
	offer,
}: Readonly<{
	application: ApplicationDetails["application"];
	offer: ApplicationDetails["offers"][number];
}>) {
	const url = offerUrl(offer.linkToken);
	return (
		<OfferLink
			className="mt-3"
			url={url}
			email={offerEmail({
				to: application.contact.email,
				contactName: application.contact.name,
				date: offer.date,
				url,
			})}
		/>
	);
}

/** What the status means and what happens next, in a sentence or two. */
function StatusMessage({
	details,
	context,
	companyName,
	requestedDates,
}: Readonly<{
	details: ApplicationDetails;
	context: SemesterContext;
	companyName: string;
	requestedDates: string[];
}>) {
	const { application, activity } = details;
	const assigned = application.assignedDate;

	switch (application.status) {
		case "applied": {
			if (assigned) {
				return (
					<>
						Tildelt <b>{longDay(assigned)}</b>. Lag tilbudet, så får du en lenke å sende til
						bedriften.
					</>
				);
			}
			const free = freeDates(context);
			const checked = application.availableDates.length;
			const open = application.availableDates.filter((date) => free.has(date)).length;
			const dates = checked === 1 ? "dato" : "datoer";
			return `Ingen dato er tildelt ennå. ${companyName} krysset av ${checked} ${dates}, og ${open} av dem er ledige.`;
		}
		case "offer_sent":
			return (
				<>
					Tilbudet gjelder <b>{assigned ? longDay(assigned) : "datoen"}</b>. Send lenken under til{" "}
					{application.contact.name}; bedriften svarer der.
				</>
			);
		case "new_date_requested": {
			const comment = lastChangeTo(activity, "new_date_requested")?.comment;
			return (
				<>
					Bedriften ber om en annen dato
					{requestedDates.length > 0 && (
						<>
							:{" "}
							{requestedDates.map((date, index) => (
								<Fragment key={date}>
									{index > 0 && listSeparator(index, requestedDates.length)}
									<b>{shortDay(date)}</b>
								</Fragment>
							))}
						</>
					)}
					.{comment && ` «${comment}»`}
				</>
			);
		}
		case "confirmed":
			return (
				<ConfirmedMessage details={details} confirmedChange={lastChangeTo(activity, "confirmed")} />
			);
		default:
			return <ClosedMessage details={details} context={context} />;
	}
}

/** «, » between days in a list, and « eller » before the last. */
function listSeparator(index: number, length: number): string {
	return index === length - 1 ? " eller " : ", ";
}

/** When and by whom a declined, rejected or withdrawn application closed, and whether its day is free. */
function ClosedMessage({
	details,
	context,
}: Readonly<{ details: ApplicationDetails; context: SemesterContext }>) {
	const { application, activity } = details;
	const { status, assignedDate } = application;
	const closingChange = lastChangeTo(activity, status);
	const dateIsFree =
		status !== "rejected" && assignedDate && !context.takenBy.has(assignedDate)
			? assignedDate
			: undefined;
	const who = closingChange && actorName(closingChange, application, context.memberNames);

	return (
		<>
			{status === "withdrawn" ? "Trukket" : "Avslått"}
			{closingChange && ` ${formatMoment(closingChange._creationTime, "longDay")} av ${who}`}
			{closingChange?.comment ? `: «${closingChange.comment}»` : "."}
			{dateIsFree && (
				<>
					{" "}
					<b>{shortDayTitle(dateIsFree)} er ledig igjen.</b>
				</>
			)}
		</>
	);
}
