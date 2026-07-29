import type { TaskSummary } from "@/lib/types";

export function dateInputToDeadline(value: string) {
  return Date.parse(`${value}T23:59:59.999Z`);
}

export function deadlineToDateInput(deadline: number) {
  return new Date(deadline).toISOString().slice(0, 10);
}

export function formatDeadline(deadline: number, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: style === "long" ? "numeric" : undefined,
  }).format(new Date(deadline));
}

export function daysUntil(deadline: number) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const deadlineDate = new Date(deadline);
  const deadlineUtc = Date.UTC(deadlineDate.getUTCFullYear(), deadlineDate.getUTCMonth(), deadlineDate.getUTCDate());
  return Math.round((deadlineUtc - todayUtc) / 86_400_000);
}

export type Urgency = "critical" | "approaching" | "upcoming" | "comfortable" | "other" | "done";

export function taskUrgency(task: TaskSummary): Urgency {
  if (task.status === "completed") return "done";
  if (task.assigneeUserId && task.assigneeUserId !== task.currentUserId) return "other";
  const days = daysUntil(task.deadline);
  if (days < 0 || days <= 1 || task.priority === "urgent") return "critical";
  if (days <= 3 || task.priority === "high") return "approaching";
  if (days <= 7 || task.priority === "medium") return "upcoming";
  return "comfortable";
}

export const urgencyLabels: Record<Urgency, string> = {
  critical: "Needs attention",
  approaching: "Approaching",
  upcoming: "Upcoming",
  comfortable: "On track",
  other: "Teammate task",
  done: "Completed",
};

export const urgencyStyles: Record<Urgency, string> = {
  critical: "border-red-500/30 bg-red-500/5",
  approaching: "border-orange-500/30 bg-orange-500/5",
  upcoming: "border-amber-500/30 bg-amber-500/5",
  comfortable: "border-emerald-500/25 bg-emerald-500/5",
  other: "border-border bg-muted/35 text-muted-foreground",
  done: "border-border bg-muted/25 text-muted-foreground",
};
