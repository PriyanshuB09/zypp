import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type NotificationKind =
  | "new_task"
  | "direct_assignment"
  | "deadline_24h"
  | "deadline_today"
  | "overdue";

const defaultPreferences = {
  newTasksEnabled: true,
  directAssignmentsEnabled: true,
  deadlineWarningsEnabled: true,
  overdueWarningsEnabled: true,
};

export async function preferencesFor(ctx: MutationCtx, userId: Id<"users">) {
  return (
    (await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_id", (builder) => builder.eq("userId", userId))
      .unique()) ?? defaultPreferences
  );
}

export async function insertNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    teamId: Id<"teams">;
    taskId?: Id<"tasks">;
    type: NotificationKind;
    threshold?: string;
    dedupeKey: string;
    title: string;
    body: string;
  },
) {
  const duplicate = await ctx.db
    .query("notifications")
    .withIndex("by_dedupe_key", (builder) => builder.eq("dedupeKey", args.dedupeKey))
    .unique();
  if (duplicate) return duplicate._id;
  return await ctx.db.insert("notifications", { ...args, createdAt: Date.now() });
}
