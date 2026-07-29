import { useMutation, useQuery } from "convex/react";
import { ArrowRightIcon, CheckSquare2Icon, CircleIcon, PlusIcon, UserRoundPlusIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { daysUntil } from "@/lib/date";

export function meta() {
  return [{ title: "Home · Zypp" }, { name: "description", content: "Your robotics assignments and upcoming work." }];
}

export default function HomeRoute() {
  const team = useQuery(api.teams.current);
  const tasks = useQuery(api.tasks.list, team ? {} : "skip");

  if (team === undefined || (team && tasks === undefined)) return <HomeLoading />;
  if (!team) return <TeamOnboarding />;

  const mine = (tasks ?? []).filter((task) => task.assigneeUserId === task.currentUserId && task.status !== "completed");
  const available = (tasks ?? []).filter((task) => !task.assigneeUserId && task.status !== "completed");
  const attention = mine.filter((task) => daysUntil(task.deadline) <= 3 || task.priority === "urgent" || task.priority === "high");
  const nextTasks = [...mine].sort((a, b) => a.deadline - b.deadline).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow={team.name}
        title="Your focus"
        description={mine.length ? `You have ${mine.length} active ${mine.length === 1 ? "assignment" : "assignments"}.` : "Your assignment list is clear."}
        actions={<Button render={<Link to="/tasks/new" />}><PlusIcon data-icon="inline-start" /> Create task</Button>}
      />

      {attention.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Needs attention</h2><p className="text-sm text-muted-foreground">Due soon or marked high priority.</p></div></div>
          <div className="grid gap-3 md:grid-cols-2">{attention.slice(0, 4).map((task) => <TaskCard key={task._id} task={task} />)}</div>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Assigned to you</h2><p className="text-sm text-muted-foreground">Your next work, sorted by deadline.</p></div><Button render={<Link to="/tasks" />} variant="ghost" size="sm">All tasks <ArrowRightIcon data-icon="inline-end" /></Button></div>
        {nextTasks.length ? <div className="grid gap-3 md:grid-cols-2">{nextTasks.map((task) => <TaskCard key={task._id} task={task} />)}</div> : <EmptyState icon={CheckSquare2Icon} title="Nothing assigned" description="Claim an available task or ask your team owner for an assignment." />}
      </section>

      <section className="mt-10">
        <div className="mb-4"><h2 className="text-lg font-semibold">Available to claim</h2><p className="text-sm text-muted-foreground">Unassigned work your team can pick up.</p></div>
        {available.length ? <div className="grid gap-3 md:grid-cols-2">{available.slice(0, 4).map((task) => <TaskCard key={task._id} task={task} />)}</div> : <EmptyState icon={UserRoundPlusIcon} title="No unclaimed tasks" description="Everything is assigned. New unassigned tasks will appear here in real time." />}
      </section>
    </main>
  );
}

function TeamOnboarding() {
  const createTeam = useMutation(api.teams.create);
  const joinTeam = useMutation(api.teams.join);
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, mode: "create" | "join") {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    try {
      if (mode === "create") {
        await createTeam({ name: String(formData.get("teamName") ?? "") });
        toast.success("Team created");
      } else {
        const inviteCode = String(formData.get("inviteCode") ?? "").trim();
        await joinTeam({ inviteCode });
        toast.success("Joined team");
      }
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your team.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-4xl place-items-center px-4 py-12 sm:px-6">
      <section className="w-full">
        <div className="mx-auto max-w-xl text-center"><span className="mx-auto grid size-12 place-items-center rounded-full border-2 border-primary text-primary"><CircleIcon className="size-4 fill-current" /></span><h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Bring your robotics team into Zypp</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Create a new team space or join one with an invite code.</p></div>
        <Tabs defaultValue="create" className="mx-auto mt-8 max-w-md">
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="create">Create a team</TabsTrigger><TabsTrigger value="join">Join a team</TabsTrigger></TabsList>
          <TabsContent value="create"><Card><CardHeader><CardTitle>Start a team</CardTitle><CardDescription>You become the owner and can invite members.</CardDescription></CardHeader><CardContent><form onSubmit={(event) => void submit(event, "create")} className="space-y-4"><div className="space-y-2"><Label htmlFor="teamName">Team name</Label><Input id="teamName" name="teamName" placeholder="Circuit Breakers" maxLength={100} required /></div><Button type="submit" className="w-full" disabled={pending}>Create team</Button></form></CardContent></Card></TabsContent>
          <TabsContent value="join"><Card><CardHeader><CardTitle>Join your team</CardTitle><CardDescription>Paste the code from your team's invite link.</CardDescription></CardHeader><CardContent><form onSubmit={(event) => void submit(event, "join")} className="space-y-4"><div className="space-y-2"><Label htmlFor="inviteCode">Invite code</Label><Input id="inviteCode" name="inviteCode" autoCapitalize="none" required /></div><Button type="submit" className="w-full" disabled={pending}>Join team</Button></form></CardContent></Card></TabsContent>
        </Tabs>
      </section>
    </main>
  );
}

function HomeLoading() {
  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6"><Skeleton className="h-16 w-72" /><div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-52 rounded-2xl" /></div></main>;
}
