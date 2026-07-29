import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  displayName,
  getMembershipForUser,
  requireMembership,
  requireOwner,
  requireUserId,
} from "./lib/auth";
import { requiredText } from "./lib/validation";

function randomInviteCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("");
}

async function uniqueInviteCode(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomInviteCode();
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_invite_code", (builder) => builder.eq("inviteCode", code))
      .unique();
    if (!existing) return code;
  }
  throw new ConvexError("Could not generate an invite code. Try again.");
}

async function teamMemberSummary(ctx: QueryCtx, teamId: Id<"teams">) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_team_id", (builder) => builder.eq("teamId", teamId))
    .take(200);
  return await Promise.all(
    memberships.map(async (membership) => {
      const authUser = await ctx.db.get("users", membership.userId);
      return {
        membershipId: membership._id,
        userId: membership.userId,
        name: await displayName(ctx, membership.userId),
        email: authUser?.email ?? null,
        joinedAt: membership.joinedAt,
      };
    }),
  );
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const membership = await getMembershipForUser(ctx, userId);
    if (!membership) return null;
    const team = await ctx.db.get("teams", membership.teamId);
    if (!team || team.deleting) return null;
    const members = await teamMemberSummary(ctx, team._id);
    return {
      ...team,
      members: members.map((member) => ({
        ...member,
        isOwner: member.userId === team.ownerUserId,
      })),
      currentUserId: userId,
      isOwner: team.ownerUserId === userId,
    };
  },
});

export const previewInvite = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const inviteCode = args.inviteCode.trim();
    const team = await ctx.db
      .query("teams")
      .withIndex("by_invite_code", (builder) => builder.eq("inviteCode", inviteCode))
      .unique();
    if (!team || team.deleting) return null;
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_team_id", (builder) => builder.eq("teamId", team._id))
      .take(200);
    return { name: team.name, memberCount: members.length, inviteCode };
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (await getMembershipForUser(ctx, userId)) {
      throw new ConvexError("You already belong to a team.");
    }
    const name = requiredText(args.name, "Team name", 100);
    const now = Date.now();
    const inviteCode = await uniqueInviteCode(ctx);
    const teamId = await ctx.db.insert("teams", {
      name,
      ownerUserId: userId,
      inviteCode,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("memberships", { teamId, userId, joinedAt: now });
    return teamId;
  },
});

export const join = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (await getMembershipForUser(ctx, userId)) {
      throw new ConvexError("Leave your current team before joining another one.");
    }
    const team = await ctx.db
      .query("teams")
      .withIndex("by_invite_code", (builder) => builder.eq("inviteCode", args.inviteCode.trim()))
      .unique();
    if (!team || team.deleting) throw new ConvexError("This invite link is invalid.");
    await ctx.db.insert("memberships", { teamId: team._id, userId, joinedAt: Date.now() });
    return team._id;
  },
});

export const leave = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await requireMembership(ctx);
    if (access.isOwner) {
      throw new ConvexError("Transfer ownership before leaving the team.");
    }
    await ctx.db.delete("memberships", access.membership._id);
    return null;
  },
});

export const rename = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const access = await requireOwner(ctx);
    const name = requiredText(args.name, "Team name", 100);
    await ctx.db.patch("teams", access.team._id, { name, updatedAt: Date.now() });
    return null;
  },
});

export const rotateInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await requireOwner(ctx);
    const inviteCode = await uniqueInviteCode(ctx);
    await ctx.db.patch("teams", access.team._id, { inviteCode, updatedAt: Date.now() });
    return inviteCode;
  },
});

export const transferOwnership = mutation({
  args: { newOwnerUserId: v.id("users") },
  handler: async (ctx, args) => {
    const access = await requireOwner(ctx);
    if (args.newOwnerUserId === access.userId) {
      throw new ConvexError("Choose another team member.");
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_team_id_and_user_id", (builder) =>
        builder.eq("teamId", access.team._id).eq("userId", args.newOwnerUserId),
      )
      .unique();
    if (!membership) throw new ConvexError("The new owner must belong to this team.");
    await ctx.db.patch("teams", access.team._id, {
      ownerUserId: args.newOwnerUserId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const removeMember = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const access = await requireOwner(ctx);
    if (args.userId === access.userId) throw new ConvexError("The owner cannot be removed.");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_team_id_and_user_id", (builder) =>
        builder.eq("teamId", access.team._id).eq("userId", args.userId),
      )
      .unique();
    if (!membership) throw new ConvexError("This user is not a team member.");
    const assignedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_assignee_user_id_and_deadline", (builder) =>
        builder.eq("assigneeUserId", args.userId),
      )
      .take(200);
    for (const task of assignedTasks) {
      if (task.teamId === access.team._id) {
        await ctx.db.patch("tasks", task._id, { assigneeUserId: undefined, updatedAt: Date.now() });
      }
    }
    await ctx.db.delete("memberships", membership._id);
    return null;
  },
});

export const deleteTeam = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await requireOwner(ctx);
    await ctx.db.patch("teams", access.team._id, { deleting: true, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.teams.continueDeleteTeam, {
      teamId: access.team._id,
    });
    return null;
  },
});

export const continueDeleteTeam = internalMutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get("teams", args.teamId);
    if (!team) return null;

    const collections = ["requirements", "tasks", "notifications", "memberships"] as const;
    for (const table of collections) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_team_id", (builder) => builder.eq("teamId", args.teamId))
        .take(200);
      if (rows.length > 0) {
        for (const row of rows) await ctx.db.delete(table, row._id);
        await ctx.scheduler.runAfter(0, internal.teams.continueDeleteTeam, {
          teamId: args.teamId,
        });
        return null;
      }
    }
    await ctx.db.delete("teams", args.teamId);
    return null;
  },
});
