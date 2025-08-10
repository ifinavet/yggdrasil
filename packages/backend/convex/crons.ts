import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "Check and update pending registrations",
  { hours: 2 },
  internal.registration.checkPendingRegistrations
)

crons.interval(
  "Check if any points should be deleted",
  { hours: 2 },
  internal.points.checkIfAnyPointsShouldBeRemoved
)

export default crons;
