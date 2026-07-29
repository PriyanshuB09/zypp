import { useQuery } from "convex/react";
import { ListFilterIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router";

import { api } from "../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };

export function meta() { return [{ title: "Team tasks · Zypp" }]; }

export default function TasksRoute() {
  const team = useQuery(api.teams.current);
  const tasks = useQuery(api.tasks.list, team ? {} : "skip");
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("all");
  const [subsystem, setSubsystem] = useState("all");
  const [sort, setSort] = useState("deadline");

  const subsystems = useMemo(() => [...new Set((tasks ?? []).map((task) => task.subsystem).filter(Boolean))].sort(), [tasks]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (tasks ?? []).filter((task) => {
      if (query && !`${task.header} ${task.context} ${task.subsystem ?? ""}`.toLowerCase().includes(query)) return false;
      if (assignee === "mine" && task.assigneeUserId !== task.currentUserId) return false;
      if (assignee === "unassigned" && task.assigneeUserId) return false;
      if (assignee.startsWith("user:") && task.assigneeUserId !== assignee.slice(5)) return false;
      if (status === "active" && task.status === "completed") return false;
      if (status !== "all" && status !== "active" && task.status !== status) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (subsystem !== "all" && task.subsystem !== subsystem) return false;
      return true;
    }).sort((a, b) => sort === "priority" ? priorityRank[a.priority] - priorityRank[b.priority] || a.deadline - b.deadline : a.deadline - b.deadline);
  }, [assignee, priority, search, sort, status, subsystem, tasks]);

  if (team === undefined || (team && tasks === undefined)) return <TasksLoading />;
  if (!team) return <Navigate to="/" replace />;

  const assigneeOptions = [
    { value: "all", label: "All assignees" },
    { value: "mine", label: "Assigned to me" },
    { value: "unassigned", label: "Unassigned" },
    ...team.members.map((member) => ({ value: `user:${member.userId}`, label: member.name })),
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader eyebrow={team.name} title="Team tasks" description="Find an assignment, check ownership, or claim available work." actions={<Button render={<Link to="/tasks/new" />}><PlusIcon data-icon="inline-start" /> New task</Button>} />
      <section aria-label="Task filters" className="mt-8 rounded-2xl border bg-card p-3 sm:p-4">
        <div className="relative"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search tasks and context" aria-label="Search tasks" /></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Select items={assigneeOptions} value={assignee} onValueChange={(value) => setAssignee(String(value))}><SelectTrigger><ListFilterIcon /><SelectValue /></SelectTrigger><SelectContent>{assigneeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={(value) => setStatus(String(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="all">All statuses</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select>
          <Select value={priority} onValueChange={(value) => setPriority(String(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All priorities</SelectItem><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>
          <Select value={subsystem} onValueChange={(value) => setSubsystem(String(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All subsystems</SelectItem>{subsystems.map((name) => <SelectItem key={name} value={name!}>{name}</SelectItem>)}</SelectContent></Select>
          <Select value={sort} onValueChange={(value) => setSort(String(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="deadline">Sort: Deadline</SelectItem><SelectItem value="priority">Sort: Priority</SelectItem></SelectContent></Select>
        </div>
      </section>
      <div className="mt-4 text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "task" : "tasks"}</div>
      {filtered.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{filtered.map((task) => <TaskCard key={task._id} task={task} />)}</div> : <div className="mt-4"><EmptyState icon={ListFilterIcon} title="No tasks match" description="Try clearing a filter or create a new assignment." /></div>}
    </main>
  );
}

function TasksLoading() { return <main className="mx-auto max-w-6xl space-y-6 px-4 py-12 sm:px-6"><Skeleton className="h-16 w-72" /><Skeleton className="h-28 rounded-2xl" /><div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-52 rounded-2xl" /></div></main>; }
