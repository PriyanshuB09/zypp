import { useMutation, useQuery } from "convex/react";
import { BellOffIcon, BellRingIcon, CheckIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type PermissionState = NotificationPermission | "unsupported";

export function meta() { return [{ title: "Notifications · Zen" }]; }

export default function NotificationsRoute() {
  const notifications = useQuery(api.notifications.list);
  const preferences = useQuery(api.notifications.preferences);
  const updatePreferences = useMutation(api.notifications.updatePreferences);
  const markRead = useMutation(api.notifications.markRead);
  const [permission, setPermission] = useState<PermissionState>(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);

  if (notifications === undefined || preferences === undefined) return <main className="mx-auto max-w-5xl px-4 py-12"><Skeleton className="h-[34rem] rounded-2xl" /></main>;

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") toast.success("Native notifications enabled");
    else toast.info("Zen will keep showing notifications in the app.");
  }

  async function changePreference(key: "newTasksEnabled" | "directAssignmentsEnabled" | "deadlineWarningsEnabled" | "overdueWarningsEnabled", checked: boolean) {
    const next = {
      newTasksEnabled: preferences!.newTasksEnabled,
      directAssignmentsEnabled: preferences!.directAssignmentsEnabled,
      deadlineWarningsEnabled: preferences!.deadlineWarningsEnabled,
      overdueWarningsEnabled: preferences!.overdueWarningsEnabled,
      [key]: checked,
    };
    try { await updatePreferences(next); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save preferences."); }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader eyebrow="Updates" title="Notifications" description="Control native alerts and review assignment or deadline updates." />
      <div className="mt-8 grid gap-5 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-5">
          <Card><CardHeader><CardTitle>Native notifications</CardTitle><CardDescription>Zen uses your browser's notification system, not simulated popups.</CardDescription></CardHeader><CardContent>{permission === "granted" ? <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"><CheckIcon className="size-4" /> Enabled on this device</div> : permission === "unsupported" ? <p className="text-sm text-muted-foreground">This browser does not support native notifications. The in-app inbox still works.</p> : <><p className="text-sm text-muted-foreground">Permission is {permission}. Zen remains fully usable without it.</p><Button className="mt-4" variant="outline" onClick={() => void requestPermission()}><BellRingIcon data-icon="inline-start" /> {permission === "denied" ? "Check browser settings" : "Enable notifications"}</Button></>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Preferences</CardTitle><CardDescription>Choose the updates that create notification records and native alerts.</CardDescription></CardHeader><CardContent className="space-y-5">{([
            ["newTasksEnabled", "New team tasks", "New work added by any member"],
            ["directAssignmentsEnabled", "Direct assignments", "Work assigned specifically to you"],
            ["deadlineWarningsEnabled", "Approaching deadlines", "24-hour and due-today reminders"],
            ["overdueWarningsEnabled", "Overdue tasks", "Alerts after a deadline passes"],
          ] as const).map(([key, title, description]) => <div key={key} className="flex items-start gap-3"><div className="flex-1"><Label htmlFor={key}>{title}</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div><Switch id={key} checked={preferences[key]} onCheckedChange={(checked) => void changePreference(key, checked)} /></div>)}</CardContent></Card>
        </aside>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Inbox</h2>
          {notifications.length ? <div className="divide-y overflow-hidden rounded-2xl border bg-card">{notifications.map((notification) => <article key={notification._id} className={cn("flex gap-3 p-4", !notification.readAt && "bg-primary/[0.04]")}><span className={cn("mt-1 size-2 shrink-0 rounded-full", notification.readAt ? "bg-muted" : "bg-primary")} /><div className="min-w-0 flex-1"><p className="font-medium">{notification.title}</p><p className="mt-1 text-sm text-muted-foreground">{notification.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(notification.createdAt)}</p></div><div className="flex shrink-0 items-start gap-1">{notification.taskId && <Button render={<Link to={`/tasks/${notification.taskId}`} />} variant="ghost" size="icon-sm" aria-label="Open task"><ExternalLinkIcon /></Button>}{!notification.readAt && <Button variant="ghost" size="icon-sm" aria-label="Mark read" onClick={() => void markRead({ notificationId: notification._id })}><CheckIcon /></Button>}</div></article>)}</div> : <EmptyState icon={BellOffIcon} title="No notifications yet" description="New tasks, direct assignments, and deadline reminders will appear here." />}
        </section>
      </div>
    </main>
  );
}
