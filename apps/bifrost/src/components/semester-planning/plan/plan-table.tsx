import { EVENT_TYPE_SHORT_LABELS } from "@workspace/shared/semester/labels";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { cn } from "@workspace/ui/lib/utils";
import { Lock } from "lucide-react";
import { Fragment } from "react";
import { LIST_HEAD } from "@/components/common/table-classes";
import { formatOrgNumber, monthLabel } from "../format";
import type { PlanDay } from "./plan-days";
import {
	CompanyName,
	DateTile,
	EventKind,
	EventTitle,
	Person,
	PlanStatus,
	RemovePlanEventButton,
	useOpenApplication,
} from "./plan-parts";

const HEAD = `${LIST_HEAD} text-left font-medium`;

/**
 * The semester plan, one row per Tuesday and Thursday and per event in the plan: the company and
 * its status, and who from Navet runs it. Editors also see the organization number and the
 * company's contact person, open an application by clicking its row, and can take an event out of
 * the plan.
 */
export function PlanTable({
	days,
	showContactDetails,
	canEdit = false,
}: Readonly<{ days: readonly PlanDay[]; showContactDetails: boolean; canEdit?: boolean }>) {
	const openApplication = useOpenApplication(showContactDetails);
	const columns = showContactDetails ? 6 : 5;

	return (
		<table className="w-full border-separate border-spacing-0 text-[14px]">
			<thead>
				<tr>
					<th className={cn(HEAD, "w-[76px] pl-4")}>Dato</th>
					<th className={HEAD}>Bedrift</th>
					<th className={HEAD}>Status</th>
					{showContactDetails && <th className={HEAD}>Kontakt i bedriften</th>}
					<th className={cn(HEAD, "border-l")}>Kontaktperson fra Navet</th>
					<th className={cn(HEAD, "pr-4")}>Medhjelpere</th>
				</tr>
			</thead>
			<tbody>
				{days.map((day, index) => {
					const month = monthLabel(day.date);
					const newMonth = index === 0 || monthLabel(days[index - 1]?.date ?? day.date) !== month;
					const monthRow = newMonth && (
						<tr>
							<th
								colSpan={columns}
								scope="colgroup"
								className="border-t bg-muted/50 px-4 py-1.5 text-left font-semibold text-[12px] text-muted-foreground uppercase tracking-wide"
							>
								{month}
							</th>
						</tr>
					);

					if (day.kind === "event") {
						const { event } = day;
						return (
							<Fragment key={event._id}>
								{monthRow}
								<tr>
									<td className="border-t py-3 pl-4">
										<DateTile date={day.date} />
									</td>
									<td className="border-t px-3 py-3">
										<div className="flex items-center gap-3">
											<CompanyLogo name={event.companyName} url={event.logoUrl ?? null} />
											<div className="min-w-0">
												<EventTitle event={event} />
												<div className="mt-0.5 text-[12.5px] text-muted-foreground">
													{event.companyName}
												</div>
											</div>
										</div>
									</td>
									<td className="border-t px-3 py-3">
										<EventKind extraDay={day.extraDay} />
									</td>
									{showContactDetails && <td className="border-t px-3 py-3" />}
									<td className="border-t border-l px-3 py-3">
										{event.responsibleName && <Person name={event.responsibleName} />}
									</td>
									<td className="border-t py-3 pr-4 pl-3">
										<div className="flex items-start justify-between gap-2">
											<div className="flex flex-col gap-1.5">
												{event.helpers.map((helper) => (
													<Person key={helper.userId} name={helper.name} small />
												))}
											</div>
											{canEdit && <RemovePlanEventButton event={event} />}
										</div>
									</td>
								</tr>
							</Fragment>
						);
					}

					if (day.kind !== "assigned") {
						const closed = day.kind === "closed";
						return (
							<Fragment key={day.date}>
								{monthRow}
								<tr className="text-muted-foreground">
									<td className="border-t py-1.5 pl-4">
										<DateTile date={day.date} muted />
									</td>
									<td colSpan={columns - 1} className="border-t px-3 py-1.5">
										{closed ? (
											<span className="inline-flex items-center gap-1.5">
												<Lock className="size-3.5" aria-hidden />
												{day.label}
											</span>
										) : (
											"Ledig"
										)}
									</td>
								</tr>
							</Fragment>
						);
					}

					const { row, details } = day;
					return (
						<Fragment key={day.date}>
							{monthRow}
							<tr
								onClick={openApplication?.(row._id)}
								className={cn(openApplication && "cursor-pointer hover:bg-muted/50")}
							>
								<td className="border-t py-3 pl-4">
									<DateTile date={day.date} />
								</td>
								<td className="border-t px-3 py-3">
									<div className="flex items-center gap-3">
										<CompanyLogo name={row.companyName} url={row.logoUrl ?? null} />
										<div className="min-w-0">
											<CompanyName row={row} linkApplication={showContactDetails} />
											<div className="mt-0.5 text-[12.5px] text-muted-foreground">
												{EVENT_TYPE_SHORT_LABELS[row.eventType]}
												{details && ` · ${formatOrgNumber(details.orgNumber)}`}
											</div>
										</div>
									</div>
								</td>
								<td className="border-t px-3 py-3">
									<PlanStatus status={row.status} />
								</td>
								{showContactDetails && (
									<td className="border-t px-3 py-3">
										{details && (
											<>
												{details.contact.name}
												<div className="text-[12.5px] text-muted-foreground">
													{details.contact.email}
												</div>
											</>
										)}
									</td>
								)}
								<td className="border-t border-l px-3 py-3">
									{row.responsibleName && <Person name={row.responsibleName} />}
								</td>
								<td className="border-t py-3 pr-4 pl-3">
									<div className="flex flex-col gap-1.5">
										{row.helpers.map((helper) => (
											<Person key={helper.userId} name={helper.name} small />
										))}
									</div>
								</td>
							</tr>
						</Fragment>
					);
				})}
			</tbody>
		</table>
	);
}
