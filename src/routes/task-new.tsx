import { useQuery } from "convex/react";
import { Navigate } from "react-router";

import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";
import { Skeleton } from "@/components/ui/skeleton";

export function meta() { return [{ title: "Create task · Zen" }]; }

export default function TaskNewRoute() {
  const team = useQuery(api.teams.current);
  if (team === undefined) return <main className="mx-auto max-w-5xl px-4 py-12"><Skeleton className="h-96 rounded-2xl" /></main>;
  if (!team) return <Navigate to="/" replace />;
  return <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12"><PageHeader eyebrow="New assignment" title="Create a task" description="Give your team the context and a clear checklist, then decide who should own it." /><TaskForm team={team} /></main>;
}
