import { afterEach, describe, expect, test, vi } from "vitest";

import { taskUrgency } from "./date";
import type { TaskSummary } from "./types";

function task(overrides: Partial<TaskSummary> = {}) {
  return {
    status: "open",
    priority: "low",
    deadline: Date.UTC(2030, 0, 20, 23, 59, 59),
    assigneeUserId: "user-a",
    currentUserId: "user-a",
    ...overrides,
  } as TaskSummary;
}

describe("calendar urgency", () => {
  afterEach(() => vi.useRealTimers());

  test("distinguishes overdue, approaching, upcoming, comfortable, teammate, and completed work", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-10T12:00:00Z"));
    expect(taskUrgency(task({ deadline: Date.UTC(2030, 0, 9, 23, 59, 59) }))).toBe("critical");
    expect(taskUrgency(task({ deadline: Date.UTC(2030, 0, 13, 23, 59, 59) }))).toBe("approaching");
    expect(taskUrgency(task({ deadline: Date.UTC(2030, 0, 16, 23, 59, 59), priority: "medium" }))).toBe("upcoming");
    expect(taskUrgency(task({ deadline: Date.UTC(2030, 0, 25, 23, 59, 59) }))).toBe("comfortable");
    expect(taskUrgency(task({ assigneeUserId: "user-b" as TaskSummary["assigneeUserId"] }))).toBe("other");
    expect(taskUrgency(task({ status: "completed" }))).toBe("done");
  });
});
