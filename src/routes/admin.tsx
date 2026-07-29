import { useMutation, useQuery } from "convex/react";
import { CopyIcon, CrownIcon, RefreshCwIcon, ShieldAlertIcon, Trash2Icon, UserMinusIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function meta() { return [{ title: "Team admin · Zen" }]; }

export default function AdminRoute() {
  const team = useQuery(api.teams.current);
  const rename = useMutation(api.teams.rename);
  const rotateInvite = useMutation(api.teams.rotateInvite);
  const removeMember = useMutation(api.teams.removeMember);
  const transferOwnership = useMutation(api.teams.transferOwnership);
  const deleteTeam = useMutation(api.teams.deleteTeam);
  const [newOwner, setNewOwner] = useState<string>("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const navigate = useNavigate();
  if (team === undefined) return <main className="mx-auto max-w-5xl px-4 py-12"><Skeleton className="h-[34rem] rounded-2xl" /></main>;
  if (!team?.isOwner) return <Navigate to="/team" replace />;
  const joinUrl = `${window.location.origin}/join/${team.inviteCode}`;
  const otherMembers = team.members.filter((member) => member.userId !== team.currentUserId);

  async function run(action: () => Promise<unknown>, success: string) { try { await action(); toast.success(success); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update the team."); } }
  async function handleRename(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const name = String(new FormData(event.currentTarget).get("name") ?? ""); await run(() => rename({ name }), "Team renamed"); }
  async function handleDelete() { try { await deleteTeam({}); toast.success("Team deletion started"); navigate("/"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete the team."); } }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader eyebrow="Owner controls" title="Team administration" description="Manage membership, invites, ownership, and the team itself." />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Team settings</CardTitle><CardDescription>Created {new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(team.createdAt)}</CardDescription></CardHeader><CardContent><form onSubmit={(event) => void handleRename(event)} className="flex gap-2"><div className="flex-1"><Label htmlFor="teamName" className="sr-only">Team name</Label><Input id="teamName" name="name" defaultValue={team.name} maxLength={100} required /></div><Button type="submit">Rename</Button></form></CardContent></Card>
        <Card><CardHeader><CardTitle>Join link</CardTitle><CardDescription>Copy the current link or rotate it to invalidate the old one.</CardDescription></CardHeader><CardContent><code className="block overflow-x-auto rounded-xl bg-muted px-3 py-2 text-xs">{joinUrl}</code><div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => void navigator.clipboard.writeText(joinUrl).then(() => toast.success("Invite link copied"))}><CopyIcon data-icon="inline-start" /> Copy</Button><AlertDialog><AlertDialogTrigger render={<Button variant="outline" />}><RefreshCwIcon data-icon="inline-start" /> Rotate</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Rotate the invite link?</AlertDialogTitle><AlertDialogDescription>The current invite will stop working immediately. Existing members are unaffected.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void run(() => rotateInvite({}), "Invite link rotated")}>Rotate link</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></CardContent></Card>
      </div>

      <Card className="mt-5"><CardHeader><CardTitle>Membership</CardTitle><CardDescription>Owners can remove members. Their assigned tasks become available.</CardDescription></CardHeader><CardContent className="divide-y">{team.members.map((member) => <div key={member.userId} className="flex items-center gap-3 py-3"><Avatar><AvatarFallback>{member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate font-medium">{member.name}</p><p className="truncate text-sm text-muted-foreground">{member.email}</p></div>{member.isOwner ? <Badge variant="secondary"><CrownIcon /> Owner</Badge> : <AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="sm" />}><UserMinusIcon data-icon="inline-start" /> Remove</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {member.name}?</AlertDialogTitle><AlertDialogDescription>They will lose team access and their assignments will become unassigned.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void run(() => removeMember({ userId: member.userId }), "Member removed")}>Remove member</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>)}</CardContent></Card>

      <Card className="mt-5"><CardHeader><CardTitle>Transfer ownership</CardTitle><CardDescription>The new owner receives all owner permissions and you become a regular member.</CardDescription></CardHeader><CardContent>{otherMembers.length ? <div className="flex flex-col gap-3 sm:flex-row"><Select value={newOwner} onValueChange={(value) => setNewOwner(String(value))}><SelectTrigger className="w-full"><SelectValue placeholder="Choose a member" /></SelectTrigger><SelectContent>{otherMembers.map((member) => <SelectItem key={member.userId} value={member.userId}>{member.name}</SelectItem>)}</SelectContent></Select><AlertDialog><AlertDialogTrigger render={<Button disabled={!newOwner} />}><CrownIcon data-icon="inline-start" /> Transfer</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Transfer team ownership?</AlertDialogTitle><AlertDialogDescription>You will immediately lose access to owner-only controls.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void run(() => transferOwnership({ newOwnerUserId: newOwner as Id<"users"> }), "Ownership transferred")}>Confirm transfer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div> : <p className="text-sm text-muted-foreground">Invite another member before transferring ownership.</p>}</CardContent></Card>

      <Card className="mt-5 border-destructive/30"><CardHeader><CardTitle className="text-destructive">Delete team</CardTitle><CardDescription>Permanently removes the team, tasks, requirements, memberships, and related notifications.</CardDescription></CardHeader><CardContent><AlertDialog><AlertDialogTrigger render={<Button variant="destructive" />}><Trash2Icon data-icon="inline-start" /> Delete team</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><ShieldAlertIcon className="size-8 text-destructive" /><AlertDialogTitle>Delete {team.name} permanently?</AlertDialogTitle><AlertDialogDescription>Type the team name exactly to confirm. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><Label htmlFor="deleteConfirmation">Team name</Label><Input id="deleteConfirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleteConfirmation !== team.name} onClick={() => void handleDelete()}>Delete everything</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card>
    </main>
  );
}
