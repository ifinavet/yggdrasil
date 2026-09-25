import type { Doc } from "@workspace/backend/convex/dataModel";
import { STATUS_LABELS } from "@workspace/shared/semester/labels";
import { cn } from "@workspace/ui/lib/utils";
import { formatMoment, shortDay } from "../format";
import { isActiveStatus, STATUS_DOT_CLASSES } from "../status";
import type { ApplicationDetails, SemesterContext } from "./model";
import { Section } from "./section";

type Activity = Doc<"companyApplicationActivity">;

/** Who did it: the member's name, the contact person for the company, or «Systemet». */
export function actorName(
	entry: Activity,
	application: ApplicationDetails["application"],
	memberNames: SemesterContext["memberNames"],
): string {
	if (entry.actor === "company") return application.contact.name;
	if (entry.actor === "system") return "Systemet";
	return (entry.actorUserId && memberNames.get(entry.actorUserId)) || "En editor";
}

/** « tir 9. feb», with a leading space, or nothing without a day. */
function dayPart(date: string | undefined, prefix = ""): string {
	return date ? ` ${prefix}${shortDay(date)}` : "";
}

function describe(entry: Activity, offers: ApplicationDetails["offers"], who: string): string {
	const offerDate = offers.find((offer) => offer._id === entry.offerId)?.date;
	const quoted = entry.comment ? `: «${entry.comment}»` : "";

	switch (entry.type) {
		case "submitted":
			return "Søknad mottatt fra Hugin";
		case "date_assigned":
			return `${who} tildelte ${entry.date ? shortDay(entry.date) : "en dato"}`;
		case "date_cleared":
			return `${who} fjernet datoen${dayPart(entry.date)}`;
		case "event_linked":
			return `${who} opprettet arrangementet`;
		case "status_changed":
			break;
	}

	switch (entry.toStatus) {
		case "offer_sent":
			return `${who} laget tilbud${dayPart(offerDate, "for ")}`;
		case "new_date_requested":
			return `${who} ba om en annen dato via lenken${quoted}`;
		case "confirmed":
			return entry.actor === "company"
				? `${who} godtok tilbudet via lenken`
				: `${who} markerte søknaden som bekreftet${quoted}`;
		case "declined":
			return `${who} takket nei via lenken${quoted}`;
		case "rejected":
			return `${who} avslo søknaden${quoted}`;
		case "withdrawn":
			return entry.actor === "company"
				? `${who} takket nei via lenken${quoted}`
				: `${who} markerte søknaden som trukket${quoted}`;
		case "applied":
			return entry.fromStatus && !isActiveStatus(entry.fromStatus)
				? `${who} gjenåpnet søknaden`
				: `Søknaden gikk tilbake til «${STATUS_LABELS.applied}» fordi datoen ble endret`;
		default:
			return `${who} endret status`;
	}
}

/** The application's history, newest first. */
export function HistoryCard({
	details,
	memberNames,
}: Readonly<{ details: ApplicationDetails; memberNames: SemesterContext["memberNames"] }>) {
	const entries = [...details.activity].sort((a, b) => b._creationTime - a._creationTime);

	return (
		<Section title="Historikk">
			<ol className="grid gap-3.5 text-[13px] tabular-nums">
				{entries.map((entry) => (
					<li key={entry._id} className="grid grid-cols-[12px_minmax(0,1fr)] gap-2.5">
						<span
							aria-hidden
							className={cn(
								"mt-1.25 size-2 rounded-full bg-ring",
								entry.toStatus && STATUS_DOT_CLASSES[entry.toStatus],
							)}
						/>
						<span className="break-words">
							{describe(entry, details.offers, actorName(entry, details.application, memberNames))}
							<small className="mt-px block text-muted-foreground text-xs leading-[normal]">
								{formatMoment(entry._creationTime, "dayTime")}
							</small>
						</span>
					</li>
				))}
			</ol>
		</Section>
	);
}
