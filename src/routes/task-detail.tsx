import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeftIcon,
  BotIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  GaugeIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserRoundPlusIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDeadline } from "@/lib/date";

export function meta() { return [{ title: "Task · Zypp" }]; }

export default function TaskDetailRoute() {
  const { taskId } = useParams();
  const task = useQuery(api.tasks.get, taskId ? { taskId: taskId as Id<"tasks"> } : "skip");
  const updateStatus = useMutation(api.tasks.updateStatus);
  const claim = useMutation(api.tasks.claim);
  const removeTask = useMutation(api.tasks.remove);
  const setRequirementCompleted = useMutation(api.tasks.setRequirementCompleted);
  const addRequirement = useMutation(api.tasks.addRequirement);
  const removeRequirement = useMutation(api.tasks.removeRequirement);
  const reorderRequirements = useMutation(api.tasks.reorderRequirements);
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  if (task === undefined) return <main className="mx-auto max-w-5xl px-4 py-12"><Skeleton className="h-[32rem] rounded-2xl" /></main>;
  if (!task) return null;
  const progress = task.requirements.length ? Math.round((task.requirements.filter((item) => item.completed).length / task.requirements.length) * 100) : 0;

  async function run(action: () => Promise<unknown>, success: string) {
    try { await action(); toast.success(success); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update the task."); }
  }

  async function handleAddRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = String(new FormData(form).get("requirement") ?? "");
    await run(() => addRequirement({ taskId: task!._id, text }), "Requirement added");
    form.reset();
  }

  async function moveRequirement(index: number, direction: -1 | 1) {
    const next = [...task!.requirements];
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= next.length) return;
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    await run(() => reorderRequirements({ taskId: task!._id, requirementIds: next.map((item) => item._id) }), "Checklist reordered");
  }

  async function handleDelete() {
    setPending(true);
    try { await removeTask({ taskId: task!._id }); toast.success("Task deleted"); navigate("/tasks"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete the task."); setPending(false); }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Button render={<Link to="/tasks" />} variant="ghost" size="sm"><ArrowLeftIcon data-icon="inline-start" /> Team tasks</Button>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_18rem]">
        <article>
          <div className="flex flex-wrap gap-2"><Badge variant={task.priority === "urgent" ? "destructive" : "secondary"}>{task.priority}</Badge><Badge variant="outline">{task.status.replace("_", " ")}</Badge>{task.robotRequired && <Badge variant="outline"><BotIcon /> Robot required</Badge>}</div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{task.header}</h1>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><CalendarDaysIcon className="size-4" /> Due {formatDeadline(task.deadline, "long")}</span>{task.subsystem && <span className="inline-flex items-center gap-1.5"><GaugeIcon className="size-4" /> {task.subsystem}</span>}</div>
          <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-6"><h2 className="font-semibold">Context</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{task.context}</p>{task.pullRequestUrl && <a href={task.pullRequestUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">Open pull request <ExternalLinkIcon className="size-3.5" /></a>}</section>

          <section className="mt-6 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4"><div><h2 className="font-semibold">Requirements</h2><p className="mt-1 text-sm text-muted-foreground">{task.requirements.filter((item) => item.completed).length} of {task.requirements.length} complete</p></div><span className="text-sm font-semibold tabular-nums">{progress}%</span></div>
            <Progress value={progress} className="mt-3" aria-label={`${progress}% complete`} />
            <div className="mt-5 space-y-2">{task.requirements.map((requirement, index) => (
              <div key={requirement._id} className="group flex items-center gap-3 rounded-xl border p-3">
                <Checkbox checked={requirement.completed} disabled={!task.canWork} aria-label={`Mark ${requirement.text} ${requirement.completed ? "incomplete" : "complete"}`} onCheckedChange={(completed) => void run(() => setRequirementCompleted({ requirementId: requirement._id, completed }), completed ? "Requirement completed" : "Requirement reopened")} />
                <span className={requirement.completed ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm"}>{requirement.text}</span>
                {task.canEdit && <div className="flex items-center"><GripVerticalIcon className="mr-1 size-4 text-muted-foreground" /><Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={index === 0} onClick={() => void moveRequirement(index, -1)}>↑</Button><Button variant="ghost" size="icon-xs" aria-label="Move down" disabled={index === task.requirements.length - 1} onClick={() => void moveRequirement(index, 1)}>↓</Button><Button variant="ghost" size="icon-xs" aria-label="Remove requirement" onClick={() => void run(() => removeRequirement({ requirementId: requirement._id }), "Requirement removed")}><Trash2Icon /></Button></div>}
              </div>
            ))}</div>
            {task.canEdit && <form onSubmit={(event) => void handleAddRequirement(event)} className="mt-3 flex gap-2"><Input name="requirement" placeholder="Add a requirement" maxLength={300} required /><Button type="submit" variant="outline"><PlusIcon data-icon="inline-start" /> Add</Button></form>}
          </section>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Assignee</p><p className="mt-2 font-medium">{task.assignee?.name ?? "Available to claim"}</p>{!task.assigneeUserId && task.status !== "completed" && <Button className="mt-4 w-full" onClick={() => void run(() => claim({ taskId: task._id }), "Task claimed")}><UserRoundPlusIcon data-icon="inline-start" /> Claim task</Button>}</section>
          <section className="rounded-2xl border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>{task.canWork ? <Select value={task.status} onValueChange={(value) => void run(() => updateStatus({ taskId: task._id, status: value as "open" | "in_progress" | "completed" }), "Status updated")}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select> : <p className="mt-2 capitalize">{task.status.replace("_", " ")}</p>}</section>
          <section className="rounded-2xl border bg-card p-4 text-sm"><dl className="space-y-3"><div><dt className="text-xs text-muted-foreground">Created by</dt><dd className="mt-0.5 font-medium">{task.creator.name}</dd></div><div><dt className="text-xs text-muted-foreground">Effort</dt><dd className="mt-0.5 font-medium">{task.estimatedEffort} {task.estimatedEffort === 1 ? "point" : "points"}</dd></div></dl></section>
          {task.canEdit && <Button render={<Link to={`/tasks/${task._id}/edit`} />} variant="outline" className="w-full"><PencilIcon data-icon="inline-start" /> Edit task</Button>}
          {task.canWork && task.status !== "completed" && <Button variant="secondary" className="w-full" onClick={() => void run(() => updateStatus({ taskId: task._id, status: "completed" }), "Task completed")}><CheckCircle2Icon data-icon="inline-start" /> Mark complete</Button>}
          {task.canEdit && <AlertDialog><AlertDialogTrigger render={<Button variant="destructive" className="w-full" />}><Trash2Icon data-icon="inline-start" /> Delete task</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this task?</AlertDialogTitle><AlertDialogDescription>This removes the task, its checklist, and related notifications. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={pending} onClick={() => void handleDelete()}>{pending ? "Deleting…" : "Delete task"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
        </aside>
      </div>
    </main>
  );
}
