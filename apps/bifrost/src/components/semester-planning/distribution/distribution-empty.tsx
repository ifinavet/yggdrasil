"use client";

import type { Doc } from "@workspace/backend/convex/dataModel";
import { huginUrl } from "@workspace/shared/constants";
import { formatSemesterDay } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Link2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const FORM_URL = `${huginUrl()}/bestill-bedpres`;

/** What the semester's application form looks like right now, in one sentence. */
function formStatus(semester: Doc<"semesters">, dates: readonly Doc<"semesterDates">[]): string {
	if (semester.status === "closed") return "Søknadsperioden er stengt.";
	if (semester.status === "draft") {
		return "Skjemaet på Hugin er ikke åpnet ennå. Sett datoer og frist under Innstillinger.";
	}
	const closed = dates.filter((date) => date.closedLabel !== undefined).length;
	const details = [
		...(semester.applicationDeadline
			? [`Søknadsfrist ${formatSemesterDay(semester.applicationDeadline, "long")}`]
			: []),
		`${dates.length - closed} åpne datoer`,
		`${closed} stengt`,
	];
	return `Skjemaet på Hugin er åpent. ${details.join(" · ")}.`;
}

/** The Fordeling tab before any company has applied. */
export function DistributionEmpty({
	semester,
	dates,
}: Readonly<{ semester: Doc<"semesters">; dates: readonly Doc<"semesterDates">[] }>) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const openSettings = () => {
		const params = new URLSearchParams(searchParams);
		params.set("tab", "innstillinger");
		router.replace(`${pathname}?${params.toString()}`, { scroll: false });
	};

	const copyFormLink = async () => {
		try {
			await navigator.clipboard.writeText(FORM_URL);
			toast.success("Lenken til skjemaet er kopiert.");
		} catch {
			toast.error(`Kunne ikke kopiere lenken. Den er ${FORM_URL}`);
		}
	};

	return (
		<div className="rounded-xl border bg-card px-4 py-14 text-center shadow-xs">
			<p className="font-semibold text-base">Ingen søknader ennå</p>
			<p className="mx-auto mt-1.5 mb-4 max-w-prose text-[13.5px] text-muted-foreground">
				{formStatus(semester, dates)}
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				{semester.status === "open" && (
					<Button variant="outline" onClick={copyFormLink}>
						<Link2 aria-hidden />
						Kopier lenke til skjemaet
					</Button>
				)}
				<Button variant="outline" onClick={openSettings}>
					Innstillinger
				</Button>
			</div>
		</div>
	);
}
