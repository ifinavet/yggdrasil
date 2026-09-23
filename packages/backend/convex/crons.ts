import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Registers the scheduled Convex jobs used by the backend.
 */
const crons = cronJobs();

crons.interval(
	"Check and update pending registrations",
	{ hours: 2 },
	internal.events.waitlist.mutations.checkPendingRegistrations,
);

crons.interval(
	"Check if any points should be deleted",
	{ hours: 2 },
	internal.points.mutations.checkIfAnyPointsShouldBeRemoved,
);

crons.cron(
	"Free for all on today's event",
	"0 12 * * 2,4",
	internal.events.waitlist.mutations.clearWaitlistAndPending,
);

crons.cron(
	"Update the year of each student",
	"0 0 1 8 *",
	internal.users.students.mutations.updateYear,
);

// Convex runs crons in UTC: 03:00 UTC is 04:00 or 05:00 in Oslo.
crons.cron(
	"Roll over semesters",
	"0 3 * * *",
	internal.semesterPlanning.semesters.mutations.rolloverSemesters,
	{},
);

/**
 * Exports the configured cron job collection.
 */
export default crons;
