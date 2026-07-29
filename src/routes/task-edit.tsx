import { useQuery } from "convex/react";
import { Navigate, useParams } from "react-router";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";
import { Skeleton } from "@/components/ui/skeleton";

export function meta() { return [{ title: "Edit task · Zypp" }]; }

export default function TaskEditRoute() {
  const { taskId } = useParams();
  const team = useQuery(api.teams.current);
  const task = useQuery(api.tasks.get, taskId ? { taskId: taskId as Id<"tasks"> } : "skip");
  if (team === undefined || task === undefined) return <main className="mx-auto max-w-5xl px-4 py-12"><Skeleton className="h-96 rounded-2xl" /></main>;
  if (!team || !task || !task.canEdit) return <Navigate to={taskId ? `/tasks/${taskId}` : "/tasks"} replace />;
  return <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12"><PageHeader eyebrow="Assignment" title="Edit task" description="Update the task details and assignment. Checklist items remain editable on the task page." /><TaskForm team={team} task={task} /></main>;
}
