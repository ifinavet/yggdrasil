"use client";

import { api } from "@workspace/backend/convex/api";
import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants";
import { Note } from "@workspace/ui/components/note";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQuery } from "convex/react";
import { CalendarDays } from "lucide-react";
import { FormStatePanel } from "@/components/form-state-panel";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import { ApplicationForm } from "./application-form";

/** /bestill-bedpres: the form while a semester is open, a closed page otherwise. */
export function CompanyApplication() {
	const semester = useQuery(api.semesterPlanning.semesters.queries.getOpenForApplications);

	if (semester === undefined) return <FormSkeleton />;

	// No semester takes applications: say so, and where to ask.
	if (semester === null) {
		return (
			<FormStatePanel
				icon={<CalendarDays aria-hidden className="size-6" />}
				title={COPY.closed.title}
				body={COPY.closed.body}
				action={
					<Note>
						{COPY.closed.question}{" "}
						<a
							href={`mailto:${COMPANY_CONTACT_EMAIL}`}
							className="font-semibold underline underline-offset-[3px]"
						>
							{COMPANY_CONTACT_EMAIL}
						</a>
					</Note>
				}
			/>
		);
	}

	// Keyed by semester, so a semester that opens while the page is up starts a fresh form.
	return <ApplicationForm key={semester._id} semester={semester} />;
}

function FormSkeleton() {
	return (
		<div aria-busy className="pt-1.5">
			<span className="sr-only">{COPY.loading}</span>
			<Skeleton className="h-7 w-3/4" />
			<Skeleton className="mt-2 h-4 w-1/2" />
			<Skeleton className="mt-4 h-12 w-full" />
			<Skeleton className="mt-8 h-5 w-1/3" />
			<Skeleton className="mt-4 h-[50px] w-full rounded-xl" />
			<Skeleton className="mt-6 h-[50px] w-full rounded-xl" />
			<Skeleton className="mt-2 h-[50px] w-full rounded-xl" />
		</div>
	);
}
