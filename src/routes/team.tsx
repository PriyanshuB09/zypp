import { useMutation, useQuery } from "convex/react";
import { CopyIcon, CrownIcon, LogOutIcon, SettingsIcon, UsersIcon } from "lucide-react";
import { Link, Navigate } from "react-router";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function meta() { return [{ title: "Team · Zen" }]; }

export default function TeamRoute() {
  const team = useQuery(api.teams.current);
  const leave = useMutation(api.teams.leave);
  if (team === undefined) return <main className="mx-auto max-w-5xl px-4 py-12"><Skeleton className="h-96 rounded-2xl" /></main>;
  if (!team) return <Navigate to="/" replace />;
  const joinUrl = `${window.location.origin}/join/${team.inviteCode}`;

  async function copyInvite() {
    await navigator.clipboard.writeText(joinUrl);
    toast.success("Invite link copied");
  }

  async function handleLeave() {
    try { await leave({}); toast.success("You left the team"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not leave the team."); }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader eyebrow="Team" title={team.name} description={`${team.members.length} ${team.members.length === 1 ? "member" : "members"} · Created ${new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(team.createdAt)}`} actions={team.isOwner ? <Button render={<Link to="/admin" />} variant="outline"><SettingsIcon data-icon="inline-start" /> Team admin</Button> : undefined} />
      <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Invite teammates</h2><p className="mt-1 text-sm text-muted-foreground">This reusable link lets another account join {team.name}.</p></div><Button onClick={() => void copyInvite()}><CopyIcon data-icon="inline-start" /> Copy link</Button></div><code className="mt-4 block overflow-x-auto rounded-xl bg-muted px-3 py-2 text-xs">{joinUrl}</code></section>
      <section className="mt-6"><div className="mb-4 flex items-center gap-2"><UsersIcon className="size-5 text-primary" /><h2 className="text-lg font-semibold">Members</h2></div><div className="divide-y rounded-2xl border bg-card">{team.members.map((member) => { const initials = member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); return <div key={member.userId} className="flex items-center gap-3 p-4"><Avatar><AvatarFallback>{initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate font-medium">{member.name}</p><p className="truncate text-sm text-muted-foreground">{member.email}</p></div>{member.isOwner && <Badge variant="secondary"><CrownIcon /> Owner</Badge>}{member.userId === team.currentUserId && <Badge variant="outline">You</Badge>}</div>; })}</div></section>
      {!team.isOwner && <div className="mt-8 border-t pt-6"><AlertDialog><AlertDialogTrigger render={<Button variant="outline" />}><LogOutIcon data-icon="inline-start" /> Leave team</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Leave {team.name}?</AlertDialogTitle><AlertDialogDescription>You will lose access to its tasks and calendar. You can rejoin later with a valid invite.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void handleLeave()}>Leave team</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>}
    </main>
  );
}
