import { UTM_CAMPAIGN, UTM_MEDIUM, UTM_SOURCE, utmParams } from "@workspace/shared/constants";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { semesterName } from "@workspace/shared/semester/labels";
import { formatSemesterDay, type SemesterRef } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import NavetLogo from "@/assets/navet/simple_logo_blaa.webp";
import EventCard from "@/components/events/event-card";
import SeeAllEventsButton from "./see-all-events-button";

const APPLY_HREF = `${huginUrl()}/bestill-bedpres?${new URLSearchParams(
	utmParams({
		source: UTM_SOURCE.IFI_NAVET,
		medium: UTM_MEDIUM.BANNER,
		campaign: UTM_CAMPAIGN.EVENT_APPLICATION,
		content: "home",
	}),
)}`;

export default function ApplyForEventHomeCard({
	semester,
	className,
}: Readonly<{
	semester: SemesterRef & { applicationDeadline: string };
	className?: string;
}>) {
	return (
		<div className={cn(className, "grid justify-center gap-4")}>
			<div className="mx-6 w-full max-w-64 p-1 sm:max-w-80 md:max-w-96">
				<EventCard
					event={{
						companyImage: NavetLogo.src,
						companyTitle: "Navet",
						title: `Søk om bedriftsarrangement ${semesterName(semester.term, semester.year, { inSentence: true })}`,
						teaser: `Søknadsfrist ${formatSemesterDay(semester.applicationDeadline, "long")}.`,
					}}
					action={
						<Button
							size="lg"
							className="w-fit bg-primary-light text-primary hover:bg-primary-light/90"
							asChild
						>
							<a href={APPLY_HREF}>Søk her</a>
						</Button>
					}
				/>
			</div>
			<SeeAllEventsButton />
		</div>
	);
}
