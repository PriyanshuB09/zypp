import { useMutation } from "convex/react";
import { BotIcon, CalendarDaysIcon, CircleDotIcon, GaugeIcon, UserRoundPlusIcon } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDeadline, taskUrgency, urgencyLabels, urgencyStyles } from "@/lib/date";
import type { TaskSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const priorityVariant = { low: "outline", medium: "secondary", high: "secondary", urgent: "destructive" } as const;

export function TaskCard({ task, compact = false }: { task: TaskSummary; compact?: boolean }) {
  const claim = useMutation(api.tasks.claim);
  const urgency = taskUrgency(task);
  const progress = task.requirementCount ? Math.round((task.completedRequirementCount / task.requirementCount) * 100) : 0;

  async function handleClaim() {
    try {
      await claim({ taskId: task._id });
      toast.success("Task claimed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This task is no longer available.");
    }
  }

  return (
    <article className={cn("rounded-2xl border p-4 transition-colors", urgencyStyles[urgency])}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
          <Badge variant="outline">{urgencyLabels[urgency]}</Badge>
          {task.robotRequired && <Badge variant="outline"><BotIcon /> Robot</Badge>}
        </div>
        <Link to={`/tasks/${task._id}`} className="mt-3 block text-base font-semibold leading-snug tracking-tight hover:text-primary">{task.header}</Link>
        {!compact && <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{task.context}</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><CalendarDaysIcon className="size-3.5" /> {formatDeadline(task.deadline)}</span>
        <span className="inline-flex items-center gap-1.5"><CircleDotIcon className="size-3.5" /> {task.assignee?.name ?? "Available"}</span>
        {task.subsystem && <span className="inline-flex items-center gap-1.5"><GaugeIcon className="size-3.5" /> {task.subsystem}</span>}
      </div>
      {task.requirementCount > 0 && !compact && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span>Checklist</span><span>{task.completedRequirementCount} of {task.requirementCount}</span></div>
          <Progress value={progress} aria-label={`${progress}% of requirements complete`} />
        </div>
      )}
      {!task.assigneeUserId && task.status !== "completed" && (
        <Button size="sm" variant="outline" className="mt-4" onClick={() => void handleClaim()}><UserRoundPlusIcon data-icon="inline-start" /> Claim task</Button>
      )}
    </article>
  );
}
