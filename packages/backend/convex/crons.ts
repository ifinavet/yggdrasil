import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Registers the scheduled Convex jobs used by the backend.
 */
const crons = cronJobs();

crons.interval(
	"Prepare company planning invitations",
	{ hours: 1 },
	internal.events.planning.lifecycle.discover,
	{},
);
crons.interval(
	"Recover company planning email delivery",
	{ minutes: 5 },
	internal.events.planning.delivery.recover,
	{},
);

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

crons.interval(
	"Detect engagement alerts",
	{ minutes: 10 },
	internal.engagement.alerts.detectAlerts,
);

crons.interval(
	"Backfill and verify event stats",
	{ minutes: 5 },
	internal.engagement.statsSweep.sweepStats,
	{},
);

crons.interval(
	"Repair stats of events near their start",
	{ minutes: 10 },
	internal.engagement.statsSweep.repairRecentStats,
	{},
);

crons.interval(
	"Catch up missed registration opening alerts",
	{ minutes: 5 },
	internal.events.mutations.catchUpRegistrationOpenAlerts,
	{},
);

crons.interval(
	"Queue event reminder emails",
	{ hours: 1 },
	internal.events.reminders.mutations.queueDueReminders,
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

crons.cron("Reconcile workspace accounts", "30 3 * * *", internal.iam.actions.reconcile, {});

/**
 * Exports the configured cron job collection.
 */
crons.interval(
	"Create company Slack channels, reconcile access, send event updates and archive finished work",
	{ minutes: 5 },
	internal.events.slack.lifecycle.reconcile,
	{},
);

crons.interval(
	"Retry pending system Slack messages",
	{ minutes: 5 },
	internal.iam.notifications.retryPending,
	{},
);

export default crons;
