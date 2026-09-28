"use client";

import { api } from "@workspace/backend/convex/api";
import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants";
import { semesterName } from "@workspace/shared/semester/labels";
import { defaultApplicationSemester, osloToday } from "@workspace/shared/time";
import { ChoiceGroup } from "@workspace/ui/components/choice-group";
import { Note } from "@workspace/ui/components/note";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQuery } from "convex/react";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { fullDate } from "@/lib/company-application-format";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import { storedDraftSemesterId } from "@/lib/company-application-storage";
import { ApplicationForm, type OpenSemester } from "./application-form";

/** /bestill-bedpres: the form while a semester is open, a closed page otherwise. */
export function CompanyApplication() {
	const semesters = useQuery(api.semesterPlanning.semesters.queries.listOpenForApplications);

	if (semesters === undefined) return <FormSkeleton />;

	// No semester takes applications: say so, and where to ask.
	if (semesters.length === 0) {
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

	return <OpenSemesters semesters={semesters} />;
}

/**
 * The semester choice and the form. The company starts on the semester after the running one when
 * it is open, so an application in September is for the coming spring, and can pick the running
 * semester or a later one instead. A saved draft opens on its own semester while that is open.
 */
function OpenSemesters({ semesters }: Readonly<{ semesters: readonly OpenSemester[] }>) {
	const [chosenId, setChosenId] = useState<string | null>(storedDraftSemesterId);
	const semester =
		semesters.find((candidate) => candidate._id === chosenId) ??
		defaultApplicationSemester(osloToday(Date.now()), semesters);
	if (!semester) return null;

	return (
		<>
			{semesters.length > 1 && (
				<div className="pt-1.5">
					<p id="semester-choice-label" className="m-0 mb-2 font-semibold text-[15px]">
						{COPY.semester.label}
					</p>
					<ChoiceGroup
						name="semester"
						labelledBy="semester-choice-label"
						value={semester._id}
						onChange={setChosenId}
						options={semesters.map((candidate) => ({
							value: candidate._id,
							label: semesterName(candidate.term, candidate.year),
							description: COPY.semester.deadline(fullDate(candidate.applicationDeadline)),
						}))}
					/>
				</div>
			)}
			{/* Keyed by semester, so switching semester, or one opening while the page is up, starts a
			    fresh form. The draft carries the answers over. */}
			<ApplicationForm key={semester._id} semester={semester} />
		</>
	);
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
