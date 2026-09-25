import { EVENT_TYPE_SHORT_LABELS } from "@workspace/shared/semester/labels";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { cn } from "@workspace/ui/lib/utils";
import { Lock } from "lucide-react";
import { formatOrgNumber } from "../format";
import type { PlanDay } from "./plan-days";
import { CompanyName, DateTile, Person, PlanStatus, useOpenApplication } from "./plan-parts";

/** The plan on small screens: one stacked entry per semester date instead of a wide table. */
export function PlanCards({
	days,
	showContactDetails,
}: Readonly<{ days: readonly PlanDay[]; showContactDetails: boolean }>) {
	const openApplication = useOpenApplication(showContactDetails);

	return (
		<ul className="divide-y text-sm">
			{days.map((day) => {
				if (day.kind !== "assigned") {
					return (
						<li key={day.date} className="flex items-center gap-3 px-4 py-2 text-muted-foreground">
							<DateTile date={day.date} muted />
							{day.kind === "closed" ? (
								<span className="inline-flex items-center gap-1.5">
									<Lock className="size-3.5 shrink-0" aria-hidden />
									{day.label}
								</span>
							) : (
								"Ledig"
							)}
						</li>
					);
				}

				const { row, details } = day;
				const team = row.responsibleName || row.helpers.length > 0;
				return (
					// biome-ignore lint/a11y/useKeyWithClickEvents: the company name link is the keyboard route
					<li
						key={day.date}
						onClick={openApplication?.(row._id)}
						className={cn(
							"flex gap-3 px-4 py-3",
							openApplication && "cursor-pointer hover:bg-muted/50",
						)}
					>
						<DateTile date={day.date} />
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<CompanyLogo name={row.companyName} url={row.logoUrl ?? null} />
								<CompanyName row={row} linkApplication={showContactDetails} />
							</div>
							<div className="mt-0.5 text-[12.5px] text-muted-foreground">
								{EVENT_TYPE_SHORT_LABELS[row.eventType]}
								{details && ` · ${formatOrgNumber(details.orgNumber)}`}
							</div>
							<div className="mt-1.5">
								<PlanStatus status={row.status} />
							</div>
							{details && (
								<div className="mt-2 truncate text-[13px]">
									{details.contact.name}
									<span className="text-muted-foreground"> · {details.contact.email}</span>
								</div>
							)}
							{team && (
								<div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-2.5">
									{row.responsibleName && <Person name={row.responsibleName} small />}
									{row.helpers.map((helper) => (
										<Person key={helper.userId} name={helper.name} small />
									))}
								</div>
							)}
						</div>
					</li>
				);
			})}
		</ul>
	);
}
