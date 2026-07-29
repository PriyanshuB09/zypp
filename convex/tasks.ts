import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { displayName, requireMembership } from "./lib/auth";
import { insertNotification, preferencesFor } from "./lib/notifications";
import { optionalHttpUrl, optionalText, requiredText, validDeadline } from "./lib/validation";

const priority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);
const status = v.union(v.literal("open"), v.literal("in_progress"), v.literal("completed"));
const effort = v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(5), v.literal(8));

async function memberProfile(ctx: QueryCtx, userId: Id<"users">) {
  const authUser = await ctx.db.get("users", userId);
  return {
    userId,
    name: await displayName(ctx, userId),
    email: authUser?.email ?? null,
  };
}

async function taskAccess(ctx: QueryCtx | MutationCtx, taskId: Id<"tasks">) {
  const task = await ctx.db.get("tasks", taskId);
  if (!task) throw new ConvexError("Task not found.");
  const access = await requireMembership(ctx, task.teamId);
  return {
    task,
    ...access,
    canEdit: access.isOwner || task.createdByUserId === access.userId,
    canWork:
      access.isOwner ||
      task.createdByUserId === access.userId ||
      task.assigneeUserId === access.userId,
  };
}

async function validateAssignee(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  assigneeUserId: Id<"users"> | undefined,
) {
  if (!assigneeUserId) return;
  const member = await ctx.db
    .query("memberships")
    .withIndex("by_team_id_and_user_id", (builder) =>
      builder.eq("teamId", teamId).eq("userId", assigneeUserId),
    )
    .unique();
  if (!member) throw new ConvexError("The assignee must belong to your team.");
}

async function notifyTaskCreated(ctx: MutationCtx, task: Doc<"tasks">) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_team_id", (builder) => builder.eq("teamId", task.teamId))
    .take(200);
  for (const membership of memberships) {
    const preferences = await preferencesFor(ctx, membership.userId);
    if (
      task.assigneeUserId === membership.userId &&
      preferences.directAssignmentsEnabled
    ) {
      await insertNotification(ctx, {
        userId: membership.userId,
        teamId: task.teamId,
        taskId: task._id,
        type: "direct_assignment",
        dedupeKey: `task:${task._id}:assigned:${membership.userId}`,
        title: "New assignment",
        body: task.header,
      });
    } else if (preferences.newTasksEnabled) {
      await insertNotification(ctx, {
        userId: membership.userId,
        teamId: task.teamId,
        taskId: task._id,
        type: "new_task",
        dedupeKey: `task:${task._id}:new:${membership.userId}`,
        title: "New team task",
        body: task.header,
      });
    }
  }
}

async function notifyAssignment(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  assigneeUserId: Id<"users">,
) {
  const preferences = await preferencesFor(ctx, assigneeUserId);
  if (!preferences.directAssignmentsEnabled) return;
  await insertNotification(ctx, {
    userId: assigneeUserId,
    teamId: task.teamId,
    taskId: task._id,
    type: "direct_assignment",
    dedupeKey: `task:${task._id}:reassigned:${assigneeUserId}:${task.updatedAt}`,
    title: "Task assigned to you",
    body: task.header,
  });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireMembership(ctx);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team_id_and_deadline", (builder) => builder.eq("teamId", access.team._id))
      .take(200);
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_team_id", (builder) => builder.eq("teamId", access.team._id))
      .take(2000);
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_team_id", (builder) => builder.eq("teamId", access.team._id))
      .take(200);
    const people = await Promise.all(members.map((member) => memberProfile(ctx, member.userId)));
    const peopleById = new Map(people.map((person) => [person.userId, person]));
    const requirementsByTask = new Map<string, typeof requirements>();
    for (const requirement of requirements) {
      const current = requirementsByTask.get(requirement.taskId) ?? [];
      current.push(requirement);
      requirementsByTask.set(requirement.taskId, current);
    }
    return tasks.map((task) => {
      const taskRequirements = requirementsByTask.get(task._id) ?? [];
      return {
        ...task,
        assignee: task.assigneeUserId ? peopleById.get(task.assigneeUserId) ?? null : null,
        creator: peopleById.get(task.createdByUserId) ?? null,
        requirementCount: taskRequirements.length,
        completedRequirementCount: taskRequirements.filter((item) => item.completed).length,
        currentUserId: access.userId,
        isOwner: access.isOwner,
      };
    });
  },
});

export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const access = await taskAccess(ctx, args.taskId);
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_task_id_and_position", (builder) => builder.eq("taskId", args.taskId))
      .take(100);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_team_id", (builder) => builder.eq("teamId", access.team._id))
      .take(200);
    const members = await Promise.all(
      memberships.map((membership) => memberProfile(ctx, membership.userId)),
    );
    return {
      ...access.task,
      requirements,
      members,
      creator: await memberProfile(ctx, access.task.createdByUserId),
      assignee: access.task.assigneeUserId
        ? await memberProfile(ctx, access.task.assigneeUserId)
        : null,
      currentUserId: access.userId,
      isOwner: access.isOwner,
      canEdit: access.canEdit,
      canWork: access.canWork,
    };
  },
});

export const create = mutation({
  args: {
    header: v.string(),
    context: v.string(),
    requirements: v.array(v.string()),
    assigneeUserId: v.optional(v.id("users")),
    subsystem: v.optional(v.string()),
    priority,
    estimatedEffort: effort,
    robotRequired: v.boolean(),
    pullRequestUrl: v.optional(v.string()),
    deadline: v.number(),
  },
  handler: async (ctx, args) => {
    const access = await requireMembership(ctx);
    if (args.assigneeUserId && !access.isOwner && args.assigneeUserId !== access.userId) {
      throw new ConvexError("Only the owner can assign work to another member.");
    }
    await validateAssignee(ctx, access.team._id, args.assigneeUserId);
    if (args.requirements.length > 50) throw new ConvexError("Use at most 50 requirements.");
    const requirements = args.requirements.map((item) => requiredText(item, "Requirement", 300));
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      teamId: access.team._id,
      createdByUserId: access.userId,
      assigneeUserId: args.assigneeUserId,
      header: requiredText(args.header, "Task header", 140),
      context: requiredText(args.context, "Context", 5000),
      subsystem: optionalText(args.subsystem, 80),
      priority: args.priority,
      estimatedEffort: args.estimatedEffort,
      robotRequired: args.robotRequired,
      pullRequestUrl: optionalHttpUrl(args.pullRequestUrl),
      deadline: validDeadline(args.deadline),
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    for (const [position, text] of requirements.entries()) {
      await ctx.db.insert("requirements", {
        teamId: access.team._id,
        taskId,
        text,
        completed: false,
        position,
      });
    }
    const task = await ctx.db.get("tasks", taskId);
    if (task) await notifyTaskCreated(ctx, task);
    return taskId;
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    header: v.string(),
    context: v.string(),
    assigneeUserId: v.optional(v.id("users")),
    subsystem: v.optional(v.string()),
    priority,
    estimatedEffort: effort,
    robotRequired: v.boolean(),
    pullRequestUrl: v.optional(v.string()),
    deadline: v.number(),
  },
  handler: async (ctx, args) => {
    const access = await taskAccess(ctx, args.taskId);
    if (!access.canEdit) throw new ConvexError("You cannot edit this task.");
    if (args.assigneeUserId && !access.isOwner && args.assigneeUserId !== access.userId) {
      throw new ConvexError("Only the owner can assign work to another member.");
    }
    await validateAssignee(ctx, access.team._id, args.assigneeUserId);
    const now = Date.now();
    await ctx.db.patch("tasks", args.taskId, {
      header: requiredText(args.header, "Task header", 140),
      context: requiredText(args.context, "Context", 5000),
      assigneeUserId: args.assigneeUserId,
      subsystem: optionalText(args.subsystem, 80),
      priority: args.priority,
      estimatedEffort: args.estimatedEffort,
      robotRequired: args.robotRequired,
      pullRequestUrl: optionalHttpUrl(args.pullRequestUrl),
      deadline: validDeadline(args.deadline),
      updatedAt: now,
    });
    if (args.assigneeUserId && args.assigneeUserId !== access.task.assigneeUserId) {
      const task = await ctx.db.get("tasks", args.taskId);
      if (task) await notifyAssignment(ctx, task, args.assigneeUserId);
    }
    return null;
  },
});

export const updateStatus = mutation({
  args: { taskId: v.id("tasks"), status },
  handler: async (ctx, args) => {
    const access = await taskAccess(ctx, args.taskId);
    if (!access.canWork) throw new ConvexError("You cannot update this task.");
    const now = Date.now();
    await ctx.db.patch("tasks", args.taskId, {
      status: args.status,
      completedAt: args.status === "completed" ? now : undefined,
      updatedAt: now,
    });
    return null;
  },
});

export const claim = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const access = await taskAccess(ctx, args.taskId);
    if (access.task.assigneeUserId) {
      throw new ConvexError("Another teammate already claimed this task.");
    }
    await ctx.db.patch("tasks", args.taskId, {
      assigneeUserId: access.userId,
      status: access.task.status === "open" ? "in_progress" : access.task.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const access = await taskAccess(ctx, args.taskId);
    if (!access.canEdit) throw new ConvexError("You cannot delete this task.");
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_task_id", (builder) => builder.eq("taskId", args.taskId))
      .take(100);
    for (const requirement of requirements) await ctx.db.delete("requirements", requirement._id);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_task_id", (builder) => builder.eq("taskId", args.taskId))
      .take(200);
    for (const notification of notifications) await ctx.db.delete("notifications", notification._id);
    await ctx.db.delete("tasks", args.taskId);
    return null;
  },
});

export const setRequirementCompleted = mutation({
  args: { requirementId: v.id("requirements"), completed: v.boolean() },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get("requirements", args.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found.");
    const access = await taskAccess(ctx, requirement.taskId);
    if (!access.canWork) throw new ConvexError("You cannot update this checklist.");
    await ctx.db.patch("requirements", requirement._id, {
      completed: args.completed,
      completedAt: args.completed ? Date.now() : undefined,
      completedByUserId: args.completed ? access.userId : undefined,
    });
    return null;
  },
});

export const addRequirement = mutation({
  args: { taskId: v.id("tasks"), text: v.string() },
  handler: async (ctx, args) => {
    const access = await taskAccess(ctx, args.taskId);
    if (!access.canEdit) throw new ConvexError("You cannot edit this checklist.");
    const existing = await ctx.db
      .query("requirements")
      .withIndex("by_task_id_and_position", (builder) => builder.eq("taskId", args.taskId))
      .take(50);
    if (existing.length >= 50) throw new ConvexError("Use at most 50 requirements.");
    return await ctx.db.insert("requirements", {
      teamId: access.team._id,
      taskId: args.taskId,
      text: requiredText(args.text, "Requirement", 300),
      completed: false,
      position: existing.length,
    });
  },
});

export const removeRequirement = mutation({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get("requirements", args.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found.");
    const access = await taskAccess(ctx, requirement.taskId);
    if (!access.canEdit) throw new ConvexError("You cannot edit this checklist.");
    await ctx.db.delete("requirements", requirement._id);
    return null;
  },
});

export const reorderRequirements = mutation({
  args: { taskId: v.id("tasks"), requirementIds: v.array(v.id("requirements")) },
  handler: async (ctx, args) => {
    const access = await taskAccess(ctx, args.taskId);
    if (!access.canEdit) throw new ConvexError("You cannot edit this checklist.");
    const existing = await ctx.db
      .query("requirements")
      .withIndex("by_task_id", (builder) => builder.eq("taskId", args.taskId))
      .take(100);
    const existingIds = new Set(existing.map((item) => item._id));
    if (
      existing.length !== args.requirementIds.length ||
      args.requirementIds.some((id) => !existingIds.has(id))
    ) {
      throw new ConvexError("Checklist order is out of date. Refresh and try again.");
    }
    for (const [position, requirementId] of args.requirementIds.entries()) {
      await ctx.db.patch("requirements", requirementId, { position });
    }
    return null;
  },
});
