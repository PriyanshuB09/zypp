/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function createTestClient() {
  return convexTest(schema, modules);
}

type TestClient = ReturnType<typeof createTestClient>;

async function createUser(t: TestClient, name: string) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", { name, email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com` });
  });
}

function asUser(t: TestClient, userId: Id<"users">) {
  return t.withIdentity({ subject: userId });
}

async function saveProfile(client: ReturnType<TestClient["withIdentity"]>, name: string) {
  await client.mutation(api.profiles.save, { name });
}

async function createTeamWithOwner(t: TestClient, name = "Circuit Breakers") {
  const ownerId = await createUser(t, "Owner");
  const owner = asUser(t, ownerId);
  await saveProfile(owner, "Owner");
  const teamId = await owner.mutation(api.teams.create, { name });
  const team = await owner.query(api.teams.current, {});
  if (!team) throw new Error("Team was not created");
  return { ownerId, owner, teamId, inviteCode: team.inviteCode };
}

async function joinMember(t: TestClient, inviteCode: string, name: string) {
  const userId = await createUser(t, name);
  const client = asUser(t, userId);
  await saveProfile(client, name);
  await client.mutation(api.teams.join, { inviteCode });
  return { userId, client };
}

const taskInput = {
  header: "Tune shooter velocity control",
  context: "Tune closed-loop control and validate it on the competition robot.",
  requirements: ["Log measured RPM", "Test current limits"],
  subsystem: "Shooter",
  priority: "high" as const,
  estimatedEffort: 3 as const,
  robotRequired: true,
  deadline: Date.UTC(2030, 0, 15, 23, 59, 59, 999),
};

describe("Zen authorization and team workflow", () => {
  let t: TestClient;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  test("requires an authenticated account and rejects invalid invites", async () => {
    await expect(t.query(api.profiles.me, {})).rejects.toThrow("signed in");
    const userId = await createUser(t, "Student");
    const student = asUser(t, userId);
    await saveProfile(student, "Student");
    await expect(student.mutation(api.teams.join, { inviteCode: "not-real" })).rejects.toThrow("invalid");
  });

  test("creates a team and lets another authenticated user join", async () => {
    const { inviteCode, teamId } = await createTeamWithOwner(t);
    const { client } = await joinMember(t, inviteCode, "Programmer");
    const joined = await client.query(api.teams.current, {});
    expect(joined?._id).toBe(teamId);
    expect(joined?.members).toHaveLength(2);
  });

  test("enforces owner assignment permissions while allowing self-assignment and unassigned work", async () => {
    const { owner, inviteCode } = await createTeamWithOwner(t);
    const { userId: memberId, client: member } = await joinMember(t, inviteCode, "Member");
    const { userId: otherId } = await joinMember(t, inviteCode, "Other");

    await expect(member.mutation(api.tasks.create, { ...taskInput, assigneeUserId: otherId })).rejects.toThrow("Only the owner");
    const selfTask = await member.mutation(api.tasks.create, { ...taskInput, assigneeUserId: memberId });
    const unassignedTask = await member.mutation(api.tasks.create, { ...taskInput, assigneeUserId: undefined });
    const ownerTask = await owner.mutation(api.tasks.create, { ...taskInput, assigneeUserId: otherId });
    expect(selfTask).toBeTruthy();
    expect(unassignedTask).toBeTruthy();
    expect(ownerTask).toBeTruthy();
  });

  test("claims an unassigned task atomically", async () => {
    const { owner, inviteCode } = await createTeamWithOwner(t);
    const first = await joinMember(t, inviteCode, "First");
    const second = await joinMember(t, inviteCode, "Second");
    const taskId = await owner.mutation(api.tasks.create, { ...taskInput, assigneeUserId: undefined });
    const results = await Promise.allSettled([
      first.client.mutation(api.tasks.claim, { taskId }),
      second.client.mutation(api.tasks.claim, { taskId }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  test("prevents cross-team task access", async () => {
    const firstTeam = await createTeamWithOwner(t, "First Team");
    const taskId = await firstTeam.owner.mutation(api.tasks.create, { ...taskInput, assigneeUserId: undefined });
    const outsiderId = await createUser(t, "Outsider");
    const outsider = asUser(t, outsiderId);
    await saveProfile(outsider, "Outsider");
    await outsider.mutation(api.teams.create, { name: "Second Team" });
    await expect(outsider.query(api.tasks.get, { taskId })).rejects.toThrow("do not belong");
  });

  test("persists checklist completion", async () => {
    const { owner, ownerId } = await createTeamWithOwner(t);
    const taskId = await owner.mutation(api.tasks.create, { ...taskInput, assigneeUserId: ownerId });
    const detail = await owner.query(api.tasks.get, { taskId });
    await owner.mutation(api.tasks.setRequirementCompleted, { requirementId: detail.requirements[0]._id, completed: true });
    const updated = await owner.query(api.tasks.get, { taskId });
    expect(updated.requirements[0].completed).toBe(true);
    expect(updated.requirements[0].completedByUserId).toBe(ownerId);
  });

  test("transfers ownership and removes old owner permissions", async () => {
    const { owner, inviteCode } = await createTeamWithOwner(t);
    const member = await joinMember(t, inviteCode, "New Owner");
    await owner.mutation(api.teams.transferOwnership, { newOwnerUserId: member.userId });
    await expect(owner.mutation(api.teams.rename, { name: "Old Owner Rename" })).rejects.toThrow("Only the team owner");
    await member.client.mutation(api.teams.rename, { name: "New Owner Team" });
    expect((await member.client.query(api.teams.current, {}))?.name).toBe("New Owner Team");
  });

  test("deduplicates overdue notifications and ignores completed tasks", async () => {
    const { owner, ownerId } = await createTeamWithOwner(t);
    const overdueInput = { ...taskInput, deadline: Date.now() - 86_400_000, assigneeUserId: ownerId };
    const activeTaskId = await owner.mutation(api.tasks.create, overdueInput);
    const completedTaskId = await owner.mutation(api.tasks.create, { ...overdueInput, header: "Already complete" });
    await owner.mutation(api.tasks.updateStatus, { taskId: completedTaskId, status: "completed" });
    await t.mutation(internal.notifications.processDeadlines, {});
    await t.mutation(internal.notifications.processDeadlines, {});
    const inbox = await owner.query(api.notifications.list, {});
    expect(inbox.filter((item) => item.taskId === activeTaskId && item.type === "overdue")).toHaveLength(1);
    expect(inbox.filter((item) => item.taskId === completedTaskId && item.type === "overdue")).toHaveLength(0);
  });

  test("deletes team data through the scheduled cascade", async () => {
    vi.useFakeTimers();
    try {
      const { owner, teamId } = await createTeamWithOwner(t);
      await owner.mutation(api.tasks.create, { ...taskInput, assigneeUserId: undefined });
      await owner.mutation(api.teams.deleteTeam, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const deleted = await t.run(async (ctx) => await ctx.db.get("teams", teamId));
      expect(deleted).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
