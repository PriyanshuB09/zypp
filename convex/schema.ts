import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const priority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);

const taskStatus = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("completed"),
);

const effort = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(5),
  v.literal(8),
);

const notificationType = v.union(
  v.literal("new_task"),
  v.literal("direct_assignment"),
  v.literal("deadline_24h"),
  v.literal("deadline_today"),
  v.literal("overdue"),
);

export default defineSchema({
  ...authTables,
  profiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),
  teams: defineTable({
    name: v.string(),
    ownerUserId: v.id("users"),
    inviteCode: v.string(),
    deleting: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_invite_code", ["inviteCode"])
    .index("by_owner_user_id", ["ownerUserId"]),
  memberships: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_id_and_user_id", ["teamId", "userId"]),
  tasks: defineTable({
    teamId: v.id("teams"),
    createdByUserId: v.id("users"),
    assigneeUserId: v.optional(v.id("users")),
    header: v.string(),
    context: v.string(),
    subsystem: v.optional(v.string()),
    priority,
    estimatedEffort: effort,
    robotRequired: v.boolean(),
    pullRequestUrl: v.optional(v.string()),
    deadline: v.number(),
    status: taskStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_team_id", ["teamId"])
    .index("by_team_id_and_deadline", ["teamId", "deadline"])
    .index("by_team_id_and_status", ["teamId", "status"])
    .index("by_assignee_user_id_and_deadline", ["assigneeUserId", "deadline"])
    .index("by_status_and_deadline", ["status", "deadline"]),
  requirements: defineTable({
    teamId: v.id("teams"),
    taskId: v.id("tasks"),
    text: v.string(),
    completed: v.boolean(),
    position: v.number(),
    completedAt: v.optional(v.number()),
    completedByUserId: v.optional(v.id("users")),
  })
    .index("by_task_id", ["taskId"])
    .index("by_task_id_and_position", ["taskId", "position"])
    .index("by_team_id", ["teamId"]),
  notificationPreferences: defineTable({
    userId: v.id("users"),
    newTasksEnabled: v.boolean(),
    directAssignmentsEnabled: v.boolean(),
    deadlineWarningsEnabled: v.boolean(),
    overdueWarningsEnabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),
  notifications: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    taskId: v.optional(v.id("tasks")),
    type: notificationType,
    threshold: v.optional(v.string()),
    dedupeKey: v.string(),
    title: v.string(),
    body: v.string(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_user_id_and_created_at", ["userId", "createdAt"])
    .index("by_team_id", ["teamId"])
    .index("by_task_id", ["taskId"])
    .index("by_dedupe_key", ["dedupeKey"]),
});
