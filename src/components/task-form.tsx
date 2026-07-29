import { useMutation } from "convex/react";
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dateInputToDeadline, deadlineToDateInput } from "@/lib/date";
import type { CurrentTeam, TaskDetail } from "@/lib/types";

type Priority = "low" | "medium" | "high" | "urgent";
type Effort = 1 | 2 | 3 | 5 | 8;

export function TaskForm({ team, task }: { team: CurrentTeam; task?: TaskDetail }) {
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const navigate = useNavigate();
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [effort, setEffort] = useState<Effort>(task?.estimatedEffort ?? 3);
  const [assignee, setAssignee] = useState<string>(task?.assigneeUserId ?? "unassigned");
  const [robotRequired, setRobotRequired] = useState(task?.robotRequired ?? false);
  const [requirements, setRequirements] = useState([""]);
  const [pending, setPending] = useState(false);

  const allowedMembers = team.isOwner
    ? team.members
    : team.members.filter((member) => member.userId === team.currentUserId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const values = {
      header: String(formData.get("header") ?? ""),
      context: String(formData.get("context") ?? ""),
      assigneeUserId: assignee === "unassigned" ? undefined : assignee as CurrentTeam["currentUserId"],
      subsystem: String(formData.get("subsystem") ?? "") || undefined,
      priority,
      estimatedEffort: effort,
      robotRequired,
      pullRequestUrl: String(formData.get("pullRequestUrl") ?? "") || undefined,
      deadline: dateInputToDeadline(String(formData.get("deadline") ?? "")),
    };
    try {
      if (task) {
        await updateTask({ taskId: task._id, ...values });
        toast.success("Task updated");
        navigate(`/tasks/${task._id}`);
      } else {
        const taskId = await createTask({ ...values, requirements: requirements.filter((item) => item.trim()) });
        toast.success("Task created");
        navigate(`/tasks/${taskId}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the task.");
    } finally {
      setPending(false);
    }
  }

  function moveRequirement(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= requirements.length) return;
    setRequirements((items) => {
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-7 rounded-2xl border bg-card p-5 sm:p-7">
        <div className="space-y-2"><Label htmlFor="header">Task header</Label><Input id="header" name="header" defaultValue={task?.header} placeholder="Tune shooter velocity control" maxLength={140} required autoFocus /></div>
        <div className="space-y-2"><Label htmlFor="context">Context</Label><Textarea id="context" name="context" defaultValue={task?.context} placeholder="Explain why this task exists, relevant constraints, and useful references." rows={7} maxLength={5000} required /></div>

        {!task && (
          <fieldset className="space-y-3">
            <div><legend className="text-sm font-medium">Requirements checklist</legend><p className="mt-1 text-xs text-muted-foreground">Add the concrete outcomes that define done.</p></div>
            {requirements.map((requirement, index) => (
              <div key={index} className="flex items-center gap-2">
                <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
                <Input value={requirement} onChange={(event) => setRequirements((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Requirement ${index + 1}`} maxLength={300} />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Move requirement up" disabled={index === 0} onClick={() => moveRequirement(index, -1)}>↑</Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Move requirement down" disabled={index === requirements.length - 1} onClick={() => moveRequirement(index, 1)}>↓</Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove requirement" disabled={requirements.length === 1} onClick={() => setRequirements((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2Icon /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" disabled={requirements.length >= 50} onClick={() => setRequirements((items) => [...items, ""])}><PlusIcon data-icon="inline-start" /> Add requirement</Button>
          </fieldset>
        )}

        <div className="space-y-2"><Label htmlFor="pullRequestUrl">Pull request link <span className="font-normal text-muted-foreground">Optional</span></Label><Input id="pullRequestUrl" name="pullRequestUrl" type="url" defaultValue={task?.pullRequestUrl} placeholder="https://github.com/team/robot/pull/42" /></div>
      </div>

      <aside className="space-y-5 rounded-2xl border bg-card p-5 lg:self-start">
        <div className="space-y-2"><Label>Assignee</Label><Select value={assignee} onValueChange={(value) => setAssignee(String(value))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned — available to claim</SelectItem>{allowedMembers.map((member) => <SelectItem key={member.userId} value={member.userId}>{member.name}{member.userId === team.currentUserId ? " (you)" : ""}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="deadline">Deadline</Label><Input id="deadline" name="deadline" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue={task ? deadlineToDateInput(task.deadline) : undefined} required /></div>
        <div className="space-y-2"><Label>Priority</Label><Select value={priority} onValueChange={(value) => setPriority(value as Priority)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Estimated effort</Label><Select value={String(effort)} onValueChange={(value) => setEffort(Number(value) as Effort)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 5, 8].map((value) => <SelectItem key={value} value={String(value)}>{value} {value === 1 ? "point" : "points"}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="subsystem">Subsystem <span className="font-normal text-muted-foreground">Optional</span></Label><Input id="subsystem" name="subsystem" defaultValue={task?.subsystem} list="subsystems" placeholder="Shooter" maxLength={80} /><datalist id="subsystems"><option value="Drive" /><option value="Shooter" /><option value="Intake" /><option value="Vision" /><option value="Autonomous" /><option value="Electrical" /><option value="Infrastructure" /><option value="Documentation" /></datalist></div>
        <div className="flex items-center gap-3 rounded-xl border p-3"><Checkbox id="robotRequired" checked={robotRequired} onCheckedChange={setRobotRequired} /><div><Label htmlFor="robotRequired">Robot required</Label><p className="text-xs text-muted-foreground">Needs physical robot access.</p></div></div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>{pending ? "Saving…" : task ? "Save changes" : "Create task"}</Button>
      </aside>
    </form>
  );
}
