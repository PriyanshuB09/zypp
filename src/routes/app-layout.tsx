import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  BellIcon,
  CalendarDaysIcon,
  CheckSquare2Icon,
  HomeIcon,
  LaptopIcon,
  LogOutIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, type FormEvent } from "react";
import { NavLink, Navigate, Outlet } from "react-router";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { BrandMark } from "@/components/brand-mark";
import { NotificationBridge } from "@/components/notification-bridge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/tasks", label: "Tasks", icon: CheckSquare2Icon, end: false },
  { to: "/calendar", label: "Calendar", icon: CalendarDaysIcon, end: false },
  { to: "/team", label: "Team", icon: UsersIcon, end: false },
] as const;

const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  );

export default function AppLayout() {
  return (
    <>
      <AuthLoading><AppLoading /></AuthLoading>
      <Unauthenticated><Navigate to="/auth" replace /></Unauthenticated>
      <Authenticated><AuthenticatedShell /></Authenticated>
    </>
  );
}

function AuthenticatedShell() {
  const profile = useQuery(api.profiles.me);
  const team = useQuery(api.teams.current);
  const notifications = useQuery(api.notifications.list);
  const { setTheme } = useTheme();
  const { signOut } = useAuthActions();

  if (!profile || team === undefined || notifications === undefined) return <AppLoading />;
  if (!profile.complete) return <ProfileSetup />;

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const initials = profile.name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "Z";

  return (
    <div className="min-h-svh pb-20 md:pb-0">
      <NotificationBridge />
      <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <NavLink to="/" className="mr-auto flex items-center gap-2.5 font-semibold tracking-tight">
            <BrandMark />
            <span className="text-lg">Zypp</span>
          </NavLink>

          {team && (
            <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={desktopNavClass}><Icon className="size-4" /> {label}</NavLink>
              ))}
              {team.isOwner && <NavLink to="/admin" className={desktopNavClass}><SettingsIcon className="size-4" /> Admin</NavLink>}
            </nav>
          )}

          {team && (
            <Button render={<NavLink to="/tasks/new" />} size="sm" className="hidden sm:inline-flex"><PlusIcon data-icon="inline-start" /> New task</Button>
          )}

          <Button render={<NavLink to="/notifications" />} variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <BellIcon />
            {unreadCount > 0 && <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{Math.min(unreadCount, 9)}</span>}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Account menu" />}>
              <Avatar className="size-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel><span className="block truncate">{profile.name}</span><span className="block truncate font-normal text-muted-foreground">{profile.email}</span></DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTheme("light")}><SunIcon /> Light theme</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}><MoonIcon /> Dark theme</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}><LaptopIcon /> System theme</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()}><LogOutIcon /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Outlet />

      {team && (
        <nav aria-label="Mobile navigation" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur md:hidden">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground")}><Icon className="size-4" /> {label}</NavLink>
          ))}
          <NavLink to="/tasks/new" className={({ isActive }) => cn("flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground")}><PlusIcon className="size-4" /> New</NavLink>
        </nav>
      )}
    </div>
  );
}

function ProfileSetup() {
  const save = useMutation(api.profiles.save);
  const [pending, setPending] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    try {
      await save({ name });
      toast.success("Welcome to Zypp");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="grid min-h-svh place-items-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-sm">
        <BrandMark className="size-10" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">What should your team call you?</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your name appears on assignments and team membership.</p>
        <div className="mt-6 space-y-2"><Label htmlFor="name">Display name</Label><Input id="name" name="name" autoComplete="name" maxLength={80} required autoFocus /></div>
        <Button type="submit" className="mt-5 w-full" disabled={pending}>{pending ? "Saving…" : "Continue"}</Button>
      </form>
    </main>
  );
}

function AppLoading() {
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6"><Skeleton className="h-12 w-48" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
}
