import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check approaching task deadlines",
  { minutes: 15 },
  internal.notifications.processDeadlines,
  {},
);

export default crons;
