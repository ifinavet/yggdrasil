import { api } from "@workspace/backend/convex/api";
import { huginUrl } from "@workspace/shared/constants";
import { semesterName } from "@workspace/shared/semester/labels";
import { formatSemesterDay, osloToday } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { fetchQuery } from "convex/nextjs";
import { ArrowRight } from "lucide-react";
import { cacheLife } from "next/cache";
import ContainerCard from "@/components/cards/container-card";

const CARD = "gap-3 bg-primary-light dark:bg-zinc-800";

/**
 * A small card on /companies with the semester open for applications, its deadline and a button
 * to the Hugin form. Nothing shows while no semester is open. Cached for minutes, not forever
 * like the rest of the page, so a newly opened semester or a changed deadline shows up quickly.
 */
export default async function ApplyForEventCard() {
	"use cache";
	cacheLife("minutes");

	const semester = await fetchQuery(
		api.semesterPlanning.semesters.queries.getOpenForApplications,
		{},
	);
	if (!semester) return null;

	const deadline = formatSemesterDay(semester.applicationDeadline, "long");
	const deadlinePassed = semester.applicationDeadline < osloToday(Date.now());

	return (
		<ContainerCard className={CARD}>
			<h2 className="font-semibold text-2xl text-primary tracking-tight dark:text-primary-foreground">
				Søk om bedriftsarrangement{" "}
				{semesterName(semester.term, semester.year, { inSentence: true })}
			</h2>
			<p className="text-base">
				{deadlinePassed ? "Søknadsfristen var" : "Søknadsfrist"}
				<b className="block font-semibold text-primary text-xl first-letter:uppercase dark:text-primary-foreground">
					{deadline}
				</b>
				{deadlinePassed && (
					<span className="mt-1 block text-muted-foreground text-sm">
						Vi tar inn sene søknader så lenge det er ledige datoer.
					</span>
				)}
			</p>
			<Button size="lg" className="w-full sm:w-fit dark:bg-primary-light dark:text-primary" asChild>
				<a href={`${huginUrl()}/bestill-bedpres`}>
					Søk på Hugin <ArrowRight aria-hidden />
				</a>
			</Button>
		</ContainerCard>
	);
}

export function ApplyForEventCardSkeleton() {
	return (
		<ContainerCard className={CARD}>
			<Skeleton className="h-8 w-3/4 rounded-md" />
			<Skeleton className="h-12 w-1/2 rounded-md" />
			<Skeleton className="h-10 w-40 rounded-md" />
		</ContainerCard>
	);
}
