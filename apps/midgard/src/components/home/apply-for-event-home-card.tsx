import { UTM_CAMPAIGN, UTM_MEDIUM, UTM_SOURCE, utmParams } from "@workspace/shared/constants";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { semesterName } from "@workspace/shared/semester/labels";
import { formatSemesterDay, type SemesterRef } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import ContainerCard from "@/components/cards/container-card";

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
			<ContainerCard className="mx-6 w-full max-w-64 gap-3 bg-primary-light px-6 sm:max-w-80 md:max-w-96 md:px-8 dark:bg-zinc-800">
				<p className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
					For bedrifter
				</p>
				<h2 className="hyphens-auto font-semibold text-2xl text-primary tracking-tight dark:text-primary-foreground">
					Søk om bedriftsarrangement{" "}
					{semesterName(semester.term, semester.year, { inSentence: true })}
				</h2>
				<p className="text-base">
					Søknadsfrist
					<b className="block font-semibold text-primary text-xl first-letter:uppercase dark:text-primary-foreground">
						{formatSemesterDay(semester.applicationDeadline, "long")}
					</b>
				</p>
				<Button size="lg" className="w-full dark:bg-primary-light dark:text-primary" asChild>
					<a href={APPLY_HREF}>
						Søk her <ArrowRight aria-hidden />
					</a>
				</Button>
			</ContainerCard>
			<Button
				asChild
				className="mx-8 bg-emerald-600 py-6 font-semibold text-primary-foreground hover:bg-emerald-700 md:mx-16"
			>
				<Link href={"/events"}>Se alle arrangementer</Link>
			</Button>
		</div>
	);
}
