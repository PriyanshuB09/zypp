import type { FunctionReturnType } from "convex/server";

import { api } from "../../convex/_generated/api";

export type TaskSummary = FunctionReturnType<typeof api.tasks.list>[number];
export type TaskDetail = NonNullable<FunctionReturnType<typeof api.tasks.get>>;
export type CurrentTeam = NonNullable<FunctionReturnType<typeof api.teams.current>>;
