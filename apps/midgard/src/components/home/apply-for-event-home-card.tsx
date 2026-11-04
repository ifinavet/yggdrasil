import { UTM_CAMPAIGN, UTM_MEDIUM, UTM_SOURCE, utmParams } from "@workspace/shared/constants";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { semesterName } from "@workspace/shared/semester/labels";
import { formatSemesterDay, type SemesterRef } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import { deadlineCountdown } from "@/lib/home-apply-semester";

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
	today,
	className,
}: Readonly<{
	semester: SemesterRef & { applicationDeadline: string };
	today: string;
	className?: string;
}>) {
	return (
		<div className={cn(className, "grid justify-center gap-4")}>
			<div className="relative mx-6 w-full max-w-64 overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white shadow-emerald-900/30 shadow-xl sm:max-w-80 md:max-w-96">
				<div
					className="pointer-events-none absolute inset-0 bg-[url(/Ns.svg)] bg-center bg-cover opacity-10 brightness-0 invert"
					aria-hidden="true"
				/>
				<div
					className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-emerald-300/30 blur-3xl"
					aria-hidden="true"
				/>
				<div className="relative flex flex-col gap-4 px-6 py-7 md:px-8">
					<span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 font-semibold text-sm ring-1 ring-white/30">
						<span className="relative flex size-2" aria-hidden="true">
							<span className="absolute inline-flex size-full rounded-full bg-emerald-200 opacity-75 motion-safe:animate-ping" />
							<span className="relative inline-flex size-2 rounded-full bg-emerald-200" />
						</span>
						Søknaden er åpen
					</span>
					<h2 className="text-balance font-bold text-3xl leading-tight tracking-tight md:text-2xl">
						Søk om bedrifts&shy;arrangement{" "}
						{semesterName(semester.term, semester.year, { inSentence: true })}
					</h2>
					<p className="text-emerald-50 leading-snug">
						Hold bedriftspresentasjon, kurs eller workshop for informatikkstudentene ved UiO.
					</p>
					<div className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-2.5">
						<CalendarClock className="size-6 shrink-0 text-emerald-200" aria-hidden />
						<p className="text-emerald-50 text-sm">
							Søknadsfrist
							<b className="block font-semibold text-base text-white first-letter:uppercase">
								{formatSemesterDay(semester.applicationDeadline, "long")}
							</b>
							<span className="font-semibold text-emerald-200">
								{deadlineCountdown(today, semester.applicationDeadline)}
							</span>
						</p>
					</div>
					<Button
						size="lg"
						className="group w-full bg-white py-6 font-semibold text-base text-emerald-800 shadow-lg hover:bg-emerald-50"
						asChild
					>
						<a href={APPLY_HREF}>
							Søk her
							<ArrowRight
								className="motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
								aria-hidden
							/>
						</a>
					</Button>
				</div>
			</div>
			<Button asChild variant="outline" className="mx-8 py-6 font-semibold md:mx-16">
				<Link href={"/events"}>Se alle arrangementer</Link>
			</Button>
		</div>
	);
}
