import { useMutation, useQuery } from "convex/react";
import { CircleIcon, UsersIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function meta() { return [{ title: "Join team · Zen" }]; }

export default function JoinRoute() {
  const { inviteCode = "" } = useParams();
  const currentTeam = useQuery(api.teams.current);
  const preview = useQuery(api.teams.previewInvite, { inviteCode });
  const join = useMutation(api.teams.join);
  const navigate = useNavigate();
  if (currentTeam === undefined || preview === undefined) return <main className="grid min-h-[calc(100svh-4rem)] place-items-center"><Skeleton className="h-72 w-full max-w-sm rounded-3xl" /></main>;

  async function handleJoin() {
    try { await join({ inviteCode }); toast.success(`Joined ${preview?.name ?? "team"}`); navigate("/"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not join this team."); }
  }

  return <main className="grid min-h-[calc(100svh-4rem)] place-items-center px-4 py-12"><section className="w-full max-w-sm rounded-3xl border bg-card p-7 text-center shadow-sm"><span className="mx-auto grid size-12 place-items-center rounded-full border-2 border-primary text-primary"><CircleIcon className="size-4 fill-current" /></span>{currentTeam ? <><h1 className="mt-5 text-2xl font-semibold">You already belong to {currentTeam.name}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Zen supports one team per account for now.</p><Button className="mt-6" onClick={() => navigate("/")}>Return home</Button></> : preview ? <><UsersIcon className="mx-auto mt-6 size-6 text-primary" /><h1 className="mt-3 text-2xl font-semibold">Join {preview.name}</h1><p className="mt-2 text-sm text-muted-foreground">{preview.memberCount} {preview.memberCount === 1 ? "member" : "members"} already planning together.</p><Button className="mt-6 w-full" onClick={() => void handleJoin()}>Join team</Button></> : <><h1 className="mt-5 text-2xl font-semibold">Invite not found</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">This invite may be invalid or may have been rotated by the team owner.</p><Button className="mt-6" variant="outline" onClick={() => navigate("/")}>Return home</Button></>}</section></main>;
}
