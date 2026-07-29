import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

import { requireUserId } from "./lib/auth";
import { requiredText } from "./lib/validation";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (builder) => builder.eq("userId", userId))
      .unique();
    const authUser = await ctx.db.get("users", userId);
    return {
      userId,
      name: profile?.name ?? authUser?.name ?? null,
      email: authUser?.email ?? null,
      complete: Boolean(profile),
    };
  },
});

export const save = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = requiredText(args.name, "Name", 80);
    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (builder) => builder.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch("profiles", existing._id, { name, updatedAt: now });
    } else {
      await ctx.db.insert("profiles", { userId, name, createdAt: now, updatedAt: now });
    }
    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_id", (builder) => builder.eq("userId", userId))
      .unique();
    if (!preferences) {
      await ctx.db.insert("notificationPreferences", {
        userId,
        newTasksEnabled: true,
        directAssignmentsEnabled: true,
        deadlineWarningsEnabled: true,
        overdueWarningsEnabled: true,
        updatedAt: now,
      });
    }
    return null;
  },
});
