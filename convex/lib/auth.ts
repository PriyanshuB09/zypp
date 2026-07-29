import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DatabaseCtx = QueryCtx | MutationCtx;

export async function requireUserId(ctx: DatabaseCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("You must be signed in.");
  }
  return userId;
}

export async function getMembershipForUser(
  ctx: DatabaseCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_user_id", (query) => query.eq("userId", userId))
    .unique();
}

export async function requireMembership(
  ctx: DatabaseCtx,
  teamId?: Id<"teams">,
) {
  const userId = await requireUserId(ctx);
  const membership = await getMembershipForUser(ctx, userId);
  if (!membership || (teamId && membership.teamId !== teamId)) {
    throw new ConvexError("You do not belong to this team.");
  }
  const team = await ctx.db.get("teams", membership.teamId);
  if (!team || team.deleting) {
    throw new ConvexError("This team is unavailable.");
  }
  return { userId, membership, team, isOwner: team.ownerUserId === userId };
}

export async function requireOwner(ctx: DatabaseCtx, teamId?: Id<"teams">) {
  const access = await requireMembership(ctx, teamId);
  if (!access.isOwner) {
    throw new ConvexError("Only the team owner can perform this action.");
  }
  return access;
}

export async function displayName(ctx: DatabaseCtx, userId: Id<"users">) {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user_id", (query) => query.eq("userId", userId))
    .unique();
  if (profile) return profile.name;
  const authUser = await ctx.db.get("users", userId);
  return authUser?.name ?? authUser?.email?.split("@")[0] ?? "Team member";
}
