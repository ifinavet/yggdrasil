"use client";

import { closedDateLabel } from "@workspace/shared/semester/labels";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { cn } from "@workspace/ui/lib/utils";
import { Check, MessageCircle } from "lucide-react";
import { useState } from "react";
import { shortDayTitle } from "../format";
import { isActiveStatus, STATUS_CHIP_CLASSES } from "../status";
import { AssignDateDialog, replacesOffer, useAssignDate } from "./assign-date-dialog";
import { type ApplicationDetails, canAssignDate, latestOffer, type SemesterContext } from "./model";

const CHIP =
	"inline-flex h-6 items-center gap-1 rounded-full border px-2.5 font-medium text-[12px] tabular-nums";
const UNAVAILABLE = "border-transparent bg-muted/60 text-muted-foreground line-through";

/**
 * «Datoer de kan»: the days the company ticked, and the days it asked for instead. A free day
 * can be clicked to give it to the company; while an offer is open or accepted, that asks first.
 */
export function DatesCard({
	details,
	context,
	companyName,
}: Readonly<{ details: ApplicationDetails; context: SemesterContext; companyName: string }>) {
	const { application, offers } = details;
	const { assign, pending } = useAssignDate(application, companyName);
	const [confirmDate, setConfirmDate] = useState<string>();

	const offer = latestOffer(offers);
	const requested = new Set(
		application.status === "new_date_requested" && offer?.status === "new_date_requested"
			? (offer.requestedDates ?? [])
			: [],
	);
	const closedLabels = new Map(
		context.dates.flatMap((day) =>
			day.closedLabel === undefined ? [] : [[day.date, closedDateLabel(day.closedLabel)] as const],
		),
	);
	const openCount = context.dates.length - closedLabels.size;
	const shown = [...new Set([...application.availableDates, ...requested])].sort((a, b) =>
		a.localeCompare(b),
	);
	const live = isActiveStatus(application.status);
	const clickable = canAssignDate(application, context.semester);

	const pick = (date: string) => {
		if (replacesOffer(application)) setConfirmDate(date);
		else void assign(date);
	};

	return (
		<Panel
			title="Datoer de kan"
			aside={
				<PanelNote>
					<span className="tabular-nums">
						{application.availableDates.length} av {openCount}
					</span>
				</PanelNote>
			}
		>
			<PanelBody>
				<div className="flex flex-wrap gap-1.5">
					{shown.map((date) => {
						const label = shortDayTitle(date);
						if (date === application.assignedDate && live) {
							return (
								<span
									key={date}
									className={cn(
										CHIP,
										"border-transparent",
										STATUS_CHIP_CLASSES[application.status],
									)}
								>
									<Check className="size-3" strokeWidth={3} />
									{label}
								</span>
							);
						}

						const closedLabel = closedLabels.get(date);
						const holder = context.takenBy.get(date);
						if (closedLabel || holder) {
							return (
								<span
									key={date}
									className={cn(CHIP, UNAVAILABLE)}
									title={closedLabel ? `Stengt: ${closedLabel}` : `Tatt av ${holder}`}
								>
									{label}
								</span>
							);
						}

						const isRequested = requested.has(date);
						const style = cn(
							CHIP,
							"bg-background text-foreground",
							isRequested && "border-foreground/40 border-dashed",
						);
						return clickable ? (
							<button
								key={date}
								type="button"
								disabled={pending}
								onClick={() => pick(date)}
								className={cn(
									style,
									"transition-colors hover:border-foreground/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
								)}
							>
								{label}
							</button>
						) : (
							<span key={date} className={style}>
								{label}
							</span>
						);
					})}
				</div>

				{application.datePreferences && (
					<p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-attention">
						<MessageCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
						<span className="break-words">{application.datePreferences}</span>
					</p>
				)}

				{clickable && (
					<AssignDateDialog
						open={confirmDate !== undefined}
						onOpenChange={(open) => {
							if (!open) setConfirmDate(undefined);
						}}
						application={application}
						companyName={companyName}
						context={context}
						requestedDates={[...requested]}
						initialDate={confirmDate}
					/>
				)}
			</PanelBody>
		</Panel>
	);
}
