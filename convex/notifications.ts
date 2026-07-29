import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { insertNotification, preferencesFor } from "./lib/notifications";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_id_and_created_at", (builder) => builder.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const preferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_id", (builder) => builder.eq("userId", userId))
      .unique();
    return (
      existing ?? {
        newTasksEnabled: true,
        directAssignmentsEnabled: true,
        deadlineWarningsEnabled: true,
        overdueWarningsEnabled: true,
      }
    );
  },
});

export const updatePreferences = mutation({
  args: {
    newTasksEnabled: v.boolean(),
    directAssignmentsEnabled: v.boolean(),
    deadlineWarningsEnabled: v.boolean(),
    overdueWarningsEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_id", (builder) => builder.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch("notificationPreferences", existing._id, {
        ...args,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("notificationPreferences", {
        userId,
        ...args,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const notification = await ctx.db.get("notifications", args.notificationId);
    if (!notification || notification.userId !== userId) {
      throw new ConvexError("Notification not found.");
    }
    if (!notification.readAt) {
      await ctx.db.patch("notifications", notification._id, { readAt: Date.now() });
    }
    return null;
  },
});

export const markDelivered = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const notification = await ctx.db.get("notifications", args.notificationId);
    if (!notification || notification.userId !== userId) {
      throw new ConvexError("Notification not found.");
    }
    if (!notification.deliveredAt) {
      await ctx.db.patch("notifications", notification._id, { deliveredAt: Date.now() });
    }
    return null;
  },
});

export const processDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const horizon = now + 24 * 60 * 60 * 1000;
    const statuses = ["open", "in_progress"] as const;
    for (const taskStatus of statuses) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_status_and_deadline", (builder) =>
          builder.eq("status", taskStatus).lte("deadline", horizon),
        )
        .take(500);
      for (const task of tasks) {
        if (!task.assigneeUserId) continue;
        const assigneePreferences = await preferencesFor(ctx, task.assigneeUserId);
        const overdue = task.deadline < now;
        const sameUtcDay =
          new Date(task.deadline).toISOString().slice(0, 10) ===
          new Date(now).toISOString().slice(0, 10);
        const type = overdue ? "overdue" : sameUtcDay ? "deadline_today" : "deadline_24h";
        const enabled = overdue
          ? assigneePreferences.overdueWarningsEnabled
          : assigneePreferences.deadlineWarningsEnabled;
        if (enabled) {
          await insertNotification(ctx, {
            userId: task.assigneeUserId,
            teamId: task.teamId,
            taskId: task._id,
            type,
            threshold: type,
            dedupeKey: `task:${task._id}:${type}:${task.assigneeUserId}`,
            title: overdue ? "Task overdue" : sameUtcDay ? "Task due today" : "Task due within 24 hours",
            body: task.header,
          });
        }
        const team = overdue ? await ctx.db.get("teams", task.teamId) : null;
        if (team && team.ownerUserId !== task.assigneeUserId) {
          const ownerPreferences = await preferencesFor(ctx, team.ownerUserId);
          if (ownerPreferences.overdueWarningsEnabled) {
            await insertNotification(ctx, {
              userId: team.ownerUserId,
              teamId: task.teamId,
              taskId: task._id,
              type: "overdue",
              threshold: "owner_overdue",
              dedupeKey: `task:${task._id}:owner_overdue:${team.ownerUserId}`,
              title: "Team task overdue",
              body: task.header,
            });
          }
        }
      }
    }
    return null;
  },
});
