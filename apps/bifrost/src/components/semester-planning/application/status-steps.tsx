import type { ApplicationStatus } from "@workspace/shared/semester/labels";
import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";
import { formatMoment } from "../format";
import { isActiveStatus, STATUS_RING_CLASSES } from "../status";
import { type ApplicationDetails, lastChangeTo, latestOffer } from "./model";

const STEPS = ["Søkt", "Tilbud sendt", "Bekreftet"] as const;
const STEP_OF: Record<ApplicationStatus, number> = {
	applied: 0,
	offer_sent: 1,
	new_date_requested: 1,
	confirmed: 2,
	declined: 0,
	rejected: 0,
	withdrawn: 0,
};

/** When the application was confirmed, «Venter» while the company answers, or a dash. */
function confirmedStamp(
	current: number,
	status: ApplicationStatus,
	confirmedAt: number | undefined,
): string {
	if (current === 2 && confirmedAt !== undefined) return formatMoment(confirmedAt, "dayTime");
	if (status === "offer_sent" || status === "new_date_requested") return "Venter";
	return "–";
}

/**
 * Søkt, Tilbud sendt and Bekreftet as a step bar, each with when it happened. Reached steps are
 * green, and the next one is ringed in the status colour. A declined, rejected or withdrawn
 * application shows how far it got, struck through.
 */
export function StatusSteps({ details }: Readonly<{ details: ApplicationDetails }>) {
	const { application, offers, activity } = details;
	const { status } = application;
	const closed = !isActiveStatus(status);
	const offer = latestOffer(offers);
	const confirmedChange = lastChangeTo(activity, "confirmed");

	const current = closed
		? STEP_OF[lastChangeTo(activity, status)?.fromStatus ?? "applied"]
		: STEP_OF[status];
	const stamps = [
		formatMoment(application._creationTime, "day"),
		current >= 1 && offer ? formatMoment(offer.sentAt, "dayTime") : "–",
		confirmedStamp(current, status, confirmedChange?._creationTime),
	];

	return (
		<ol className="mt-1 mb-5 grid grid-cols-3" aria-label="Status">
			{STEPS.map((label, index) => {
				const reached = index <= current;
				const next = index === current + 1 && !closed;
				return (
					<li
						key={label}
						aria-current={index === current ? "step" : undefined}
						className="relative flex flex-col items-center text-center text-[13px]"
					>
						{index < STEPS.length - 1 && (
							// The line to the next step, green once that step is reached too.
							<span
								aria-hidden
								className={cn(
									"absolute top-3.5 left-1/2 h-1 w-full rounded-full bg-border",
									index < current && (closed ? "bg-muted-foreground/60" : "bg-status-confirmed"),
								)}
							/>
						)}
						<span
							aria-hidden
							className={cn(
								"relative z-10 grid size-8 place-items-center rounded-full border-2 bg-card font-semibold text-[13px] text-muted-foreground",
								reached &&
									(closed
										? "border-muted-foreground bg-muted-foreground text-background"
										: "border-status-confirmed bg-status-confirmed text-status-confirmed-foreground"),
								next && cn("text-foreground ring-4", STATUS_RING_CLASSES[status]),
							)}
						>
							{reached ? <Check className="size-4" strokeWidth={3} /> : index + 1}
						</span>
						<b
							className={cn(
								"mt-2 block font-semibold",
								closed && "text-muted-foreground line-through",
							)}
						>
							{label}
						</b>
						<span
							className={cn(
								"text-[12.5px] text-muted-foreground tabular-nums",
								closed && "line-through",
							)}
						>
							{stamps[index]}
						</span>
					</li>
				);
			})}
		</ol>
	);
}
