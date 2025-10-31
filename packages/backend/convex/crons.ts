import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"Check and update pending registrations",
	{ hours: 2 },
	internal.waitlist.checkPendingRegistrations,
);

crons.interval(
	"Check if any points should be deleted",
	{ hours: 2 },
	internal.points.checkIfAnyPointsShouldBeRemoved,
);

crons.cron(
	"Free for all on today's event",
	"0 12 * * 2,4",
	internal.waitlist.clearWaitlistAndPending,
);

crons.cron(
	"Update the year of each student",
	"0 0 1 8 *",
	internal.students.updateYear,
);

export default crons;
