import { useQuery } from "convex/react";
import { CalendarX2Icon, ChevronLeftIcon, ChevronRightIcon, ListIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router";

import { api } from "../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TaskCard } from "@/components/task-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { taskUrgency, urgencyLabels, urgencyStyles } from "@/lib/date";
import { cn } from "@/lib/utils";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function meta() { return [{ title: "Calendar · Zypp" }]; }

export default function CalendarRoute() {
  const team = useQuery(api.teams.current);
  const tasks = useQuery(api.tasks.list, team ? {} : "skip");
  const [view, setView] = useState("calendar");
  const now = new Date();
  const [month, setMonth] = useState(() => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));

  const days = useMemo(() => {
    const start = new Date(month);
    start.setUTCDate(1 - start.getUTCDay());
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setUTCDate(start.getUTCDate() + index); return day; });
  }, [month]);

  if (team === undefined || (team && tasks === undefined)) return <main className="mx-auto max-w-6xl px-4 py-12"><Skeleton className="h-[34rem] rounded-2xl" /></main>;
  if (!team) return <Navigate to="/" replace />;

  const monthTasks = (tasks ?? []).filter((task) => { const date = new Date(task.deadline); return date.getUTCFullYear() === month.getUTCFullYear() && date.getUTCMonth() === month.getUTCMonth(); });
  const monthLabel = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "long", year: "numeric" }).format(month);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader eyebrow={team.name} title="Calendar" description="Deadlines across the team, with your work highlighted by urgency." actions={<Tabs value={view} onValueChange={(value) => setView(String(value))}><TabsList><TabsTrigger value="calendar">Calendar</TabsTrigger><TabsTrigger value="list"><ListIcon /> List</TabsTrigger></TabsList></Tabs>} />
      <div className="mt-8 flex items-center justify-between rounded-2xl border bg-card p-3"><Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))}><ChevronLeftIcon /></Button><h2 className="font-semibold">{monthLabel}</h2><Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))}><ChevronRightIcon /></Button></div>
      {view === "calendar" ? (
        <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/50">{weekdays.map((day) => <div key={day} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">{day}</div>)}</div>
          <div className="grid grid-cols-7">{days.map((day) => {
            const dateKey = day.toISOString().slice(0, 10);
            const dayTasks = (tasks ?? []).filter((task) => new Date(task.deadline).toISOString().slice(0, 10) === dateKey);
            const inMonth = day.getUTCMonth() === month.getUTCMonth();
            return <div key={dateKey} className={cn("min-h-24 border-b border-r p-1.5 sm:min-h-32 sm:p-2", !inMonth && "bg-muted/25 text-muted-foreground")}><div className="mb-1 text-xs font-medium">{day.getUTCDate()}</div><div className="space-y-1">{dayTasks.slice(0, 3).map((task) => { const urgency = taskUrgency(task); return <Link key={task._id} to={`/tasks/${task._id}`} className={cn("block truncate rounded-md border px-1.5 py-1 text-[10px] font-medium sm:text-xs", urgencyStyles[urgency])} title={`${task.header} — ${urgencyLabels[urgency]}`}>{task.header}</Link>; })}{dayTasks.length > 3 && <span className="block text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</span>}</div></div>;
          })}</div>
        </div>
      ) : monthTasks.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">{monthTasks.sort((a, b) => a.deadline - b.deadline).map((task) => <TaskCard key={task._id} task={task} />)}</div>
      ) : <div className="mt-4"><EmptyState icon={CalendarX2Icon} title="No deadlines this month" description="Move to another month or create a task with a deadline here." /></div>}
      <div className="mt-5 flex flex-wrap gap-2">{(["critical", "approaching", "upcoming", "comfortable", "other"] as const).map((urgency) => <Badge key={urgency} variant="outline" className={urgencyStyles[urgency]}>{urgencyLabels[urgency]}</Badge>)}</div>
    </main>
  );
}
