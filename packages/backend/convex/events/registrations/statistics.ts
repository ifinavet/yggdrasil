import { degreeKey } from "@workspace/shared/constants";
import { toBase64 } from "@workspace/shared/utils";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";

// Shared by the event dashboard and report snapshot so both count the same registered students.
export async function getRegistrantStatistics(ctx: QueryCtx, eventId: Id<"events">) {
	const registrations = await ctx.db
		.query("registrations")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.filter((r) => r.eq(r.field("status"), "registered"))
		.collect();

	const students = await Promise.all(
		registrations.map((registration) =>
			ctx.db
				.query("students")
				.withIndex("by_userId", (q) => q.eq("userId", registration.userId))
				.first(),
		),
	);
	const studentsInfo = students
		.filter((student) => student !== null)
		.map((student) => ({
			aar: student.year,
			program: student.studyProgram,
			degree: degreeKey(student.degree),
		}));

	const result: {
		[degree: string]: {
			[program: string]: {
				[aar: number]: number;
			};
		};
	} = {};

	for (const info of studentsInfo) {
		const { degree, program, aar } = info;
		const programBase = toBase64(program);
		if (!result[degree]) result[degree] = {};

		if (!result[degree][programBase]) result[degree][programBase] = {};

		result[degree][programBase][aar] ??= 0;

		result[degree][programBase][aar]++;
	}

	return result;
}
