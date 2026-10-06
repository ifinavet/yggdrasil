"use client";

import { DEGREE_TYPES, STUDY_PROGRAMS } from "@workspace/shared/constants";
import { StudentProfileFields } from "@workspace/ui/components/student-profile-fields";
import { z } from "zod";
import { withFieldGroup } from "@/lib/form";

export const studySchema = z.object({
	studyProgram: z.enum(STUDY_PROGRAMS),
	degree: z.enum(DEGREE_TYPES),
	year: z
		.number()
		.int()
		.min(1, "Vennligst oppgi året du går")
		.max(5, "5. året er maks, går du høyre en siste år master sett 5."),
});
export type StudyValues = z.infer<typeof studySchema>;

export const STUDY_FIELDS = {
	studyProgram: "studyProgram",
	degree: "degree",
	year: "year",
} as const;

export const StudyFields = withFieldGroup({
	defaultValues: {} as StudyValues,
	render: function Render({ group }) {
		return (
			<group.Field name="studyProgram">
				{(studyProgram) => (
					<group.Field name="degree">
						{(degree) => (
							<group.Field name="year">
								{(year) => (
									<StudentProfileFields studyProgram={studyProgram} degree={degree} year={year} />
								)}
							</group.Field>
						)}
					</group.Field>
				)}
			</group.Field>
		);
	},
});
