import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { eventHref, type OverviewEvent } from "./sections";

export function MyEventCard({ event }: Readonly<{ event: OverviewEvent }>) {
	const isLead = event.myRole === "hovedansvarlig";

	return (
		<article className="relative flex flex-col overflow-hidden rounded-[12px] border bg-card shadow-xs transition-[border-color,box-shadow] duration-150 ease-out hover:border-ring hover:shadow-[0_2px_6px_rgb(0_0_0/0.07)]">
			<div
				className={cn(
					"px-4 py-1.5 font-medium text-xs",
					isLead ? "bg-primary text-primary-foreground" : "bg-primary-light text-primary",
				)}
			>
				{isLead ? "Du er ansvarlig" : "Du er medansvarlig"}
			</div>
			<div className="flex items-center gap-3 p-4">
				<CompanyLogo name={event.companyName} url={event.companyLogoUrl} size="lg" />
				<div className="min-w-0">
					<h3 className="font-semibold text-[15px] leading-[1.3]">
						<Link href={eventHref(event)} className="after:absolute after:inset-0">
							{event.title}
						</Link>
					</h3>
					<p className="mt-0.5 text-[13px] text-muted-foreground first-letter:uppercase">
						{formatOsloDate(event.eventStart, DATE_PATTERNS.dateTime)}
					</p>
				</div>
			</div>
			{event.feedbackStatus === "draft" ? (
				<div className="mt-auto flex items-center justify-end px-4 pb-4">
					<Button asChild size="sm" className="relative z-10 text-[13px]">
						<Link href={`${eventHref(event)}/feedback/report`}>Se over rapport</Link>
					</Button>
				</div>
			) : null}
		</article>
	);
}
