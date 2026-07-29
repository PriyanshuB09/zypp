import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { CircleIcon, LoaderCircleIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthFlow = "signIn" | "signUp";

export function meta() {
  return [
    { title: "Sign in · Zen" },
    { name: "description", content: "Sign in to your robotics team's focused planner." },
  ];
}

export default function AuthRoute() {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_32%),radial-gradient(circle_at_bottom_right,color-mix(in_oklch,var(--accent)_50%,transparent),transparent_38%)]" />
      <AuthLoading><LoaderCircleIcon className="size-5 animate-spin text-muted-foreground" /></AuthLoading>
      <Unauthenticated><AuthForm /></Unauthenticated>
      <Authenticated><Navigate to="/" replace /></Authenticated>
    </main>
  );
}

function AuthForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<AuthFlow>("signIn");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
      toast.success(flow === "signIn" ? "Welcome back" : "Account created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="relative w-full max-w-sm rounded-3xl border bg-card/90 p-6 shadow-xl shadow-primary/5 backdrop-blur sm:p-8">
      <div className="flex items-center gap-2.5">
        <span className="relative grid size-9 place-items-center rounded-full border-2 border-primary text-primary"><CircleIcon className="size-3 fill-current" /></span>
        <span className="text-lg font-semibold">Zen</span>
      </div>
      <h1 className="mt-8 text-3xl font-semibold tracking-[-0.04em]">Plan the work. Build the robot.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">A calm, shared task space for robotics programming teams.</p>

      <Tabs value={flow} onValueChange={(value) => setFlow(value as AuthFlow)} className="mt-7">
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="signIn">Sign in</TabsTrigger><TabsTrigger value="signUp">Create account</TabsTrigger></TabsList>
      </Tabs>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {flow === "signUp" && <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" autoComplete="name" maxLength={80} required /></div>}
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} minLength={8} required /></div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
          {flow === "signIn" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </section>
  );
}
