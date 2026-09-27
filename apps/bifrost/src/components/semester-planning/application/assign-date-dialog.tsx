"use client";

import { api } from "@workspace/backend/convex/api";
import { closedDateLabel } from "@workspace/shared/semester/labels";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { Check } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { shortDay, shortDayTitle } from "../format";
import {
	type Application,
	MOVE_CONFIRMED_WARNING,
	type SemesterContext,
	useRunMutation,
} from "./model";

const OFFER_STATUSES: ReadonlySet<Application["status"]> = new Set([
	"offer_sent",
	"new_date_requested",
	"confirmed",
]);

/** Whether giving the application a new date takes back an offer the company has or accepted. */
export function replacesOffer(application: Application): boolean {
	return OFFER_STATUSES.has(application.status);
}

/** Gives the application a date, or clears it with null, and says how it went. */
export function useAssignDate(application: Application, companyName: string) {
	const assignDate = useMutation(api.semesterPlanning.applications.mutations.assignDate);
	const { pending, run } = useRunMutation();

	const assign = useCallback(
		(date: string | null) =>
			run(
				() => assignDate({ applicationId: application._id, date }),
				({ outsideAvailable }) => {
					if (date === null) toast.success("Datoen er fjernet.");
					else if (outsideAvailable)
						toast.warning(
							`${companyName} har ikke krysset av ${shortDay(date)}. Datoen er tildelt likevel.`,
						);
					else toast.success(`${companyName} har fått ${shortDay(date)}.`);
				},
			),
		[application._id, assignDate, companyName, run],
	);

	return { assign, pending };
}

type DateOption = {
	date: string;
	checked: boolean;
	requested: boolean;
	/** Why the day cannot be picked, and the closed label or the company holding it. */
	blocked?: { reason: "stengt" | "tatt"; detail: string };
};

/**
 * Picks a date for the application among the semester's days. The days the company ticked or
 * asked for come first; a closed or taken day cannot be picked.
 */
export function AssignDateDialog({
	open,
	onOpenChange,
	application,
	companyName,
	context,
	requestedDates,
	initialDate,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	application: Application;
	companyName: string;
	context: SemesterContext;
	requestedDates: string[];
	initialDate?: string;
}>) {
	const { assign, pending } = useAssignDate(application, companyName);
	const [picked, setPicked] = useState<string | undefined>(initialDate);
	const [lastInitial, setLastInitial] = useState(initialDate);
	if (initialDate !== lastInitial) {
		setLastInitial(initialDate);
		setPicked(initialDate);
	}

	const checked = new Set(application.availableDates);
	const requested = new Set(requestedDates);
	const options: DateOption[] = context.dates
		.filter((day) => day.date !== application.assignedDate || !replacesOffer(application))
		.map((day) => ({
			date: day.date,
			checked: checked.has(day.date),
			requested: requested.has(day.date),
			blocked: blockedReason(day.closedLabel, context.takenBy.get(day.date)),
		}));
	const wanted = options.filter((option) => option.checked || option.requested);
	const others = options.filter((option) => !option.checked && !option.requested);
	const pickedOption = options.find((option) => option.date === picked);

	const close = (next: boolean) => {
		if (!next) setPicked(initialDate);
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Tildel dato til {companyName}</DialogTitle>
					<DialogDescription>{assignDescription(application)}</DialogDescription>
				</DialogHeader>

				<DateGroup
					title={requestedDates.length > 0 ? "Ønsket eller krysset av" : "Datoer de kan"}
					options={wanted}
					picked={picked}
					onPick={setPicked}
					empty="Bedriften krysset ikke av noen datoer i semesteret."
				/>
				<DateGroup
					title="Andre datoer i semesteret"
					options={others}
					picked={picked}
					onPick={setPicked}
					empty="Ingen andre datoer."
				/>

				{pickedOption && !pickedOption.checked && !pickedOption.requested && (
					<p role="alert" className="font-medium text-attention text-sm">
						{companyName} har ikke krysset av {shortDay(pickedOption.date)}. Du kan tildele den
						likevel.
					</p>
				)}

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => close(false)}>
						Avbryt
					</Button>
					<Button
						type="button"
						disabled={!picked || pending}
						onClick={async () => {
							if (picked && (await assign(picked))) close(false);
						}}
					>
						{assignLabel(pending, picked)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** What giving the application a date does to its status and any offer. */
function assignDescription(application: Application): string {
	if (application.status === "confirmed") {
		return `Søknaden går tilbake til «Søkt». ${MOVE_CONFIRMED_WARNING}`;
	}
	if (replacesOffer(application) && application.assignedDate) {
		return `Tilbudet på ${shortDay(application.assignedDate)} slutter å gjelde, og søknaden går tilbake til «Søkt» til du sender nytt tilbud.`;
	}
	return "Velg en dato. Tilbudet lages først når du trykker «Lag tilbud».";
}

function assignLabel(pending: boolean, picked: string | undefined): string {
	if (pending) return "Tildeler...";
	return picked ? `Tildel ${shortDay(picked)}` : "Tildel dato";
}

/** The chip style for a day: picked, blocked or free. */
function optionClasses(isPicked: boolean, blocked: boolean): string {
	if (isPicked) return "border-primary bg-primary text-primary-foreground";
	if (blocked) {
		return "bg-[repeating-linear-gradient(135deg,var(--muted)_0_3px,transparent_3px_6px)] text-muted-foreground";
	}
	return "bg-primary-light text-primary hover:border-primary";
}

function blockedReason(
	closedLabel: string | undefined,
	holder: string | undefined,
): DateOption["blocked"] {
	if (closedLabel !== undefined) return { reason: "stengt", detail: closedDateLabel(closedLabel) };
	if (holder) return { reason: "tatt", detail: holder };
	return undefined;
}

function DateGroup({
	title,
	options,
	picked,
	onPick,
	empty,
}: Readonly<{
	title: string;
	options: DateOption[];
	picked: string | undefined;
	onPick: (date: string) => void;
	empty: string;
}>) {
	return (
		<fieldset className="grid gap-2">
			<legend className="mb-2 font-medium text-sm">{title}</legend>
			{options.length === 0 ? (
				<p className="text-muted-foreground text-sm">{empty}</p>
			) : (
				<div className="flex flex-wrap gap-1.5">
					{options.map((option) => {
						const isPicked = option.date === picked;
						return (
							<button
								key={option.date}
								type="button"
								disabled={Boolean(option.blocked)}
								aria-pressed={isPicked}
								title={option.blocked?.detail}
								onClick={() => onPick(option.date)}
								className={cn(
									"inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] tabular-nums transition-colors",
									"focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
									optionClasses(isPicked, Boolean(option.blocked)),
									option.requested && !isPicked && "ring-2 ring-status-new-date",
								)}
							>
								{isPicked && <Check className="size-3.5" strokeWidth={3} />}
								{shortDayTitle(option.date)}
								{option.requested && !isPicked && " · ønsket"}
								{option.blocked && ` · ${option.blocked.reason}`}
							</button>
						);
					})}
				</div>
			)}
		</fieldset>
	);
}
