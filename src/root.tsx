import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ThemeProvider } from "next-themes";
import { ConvexReactClient } from "convex/react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/zypp-logo-circle.png" />
        <link rel="apple-touch-icon" href="/zypp-logo-circle.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return (
    <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
      Preparing Zypp…
    </div>
  );
}

export default function App() {
  const app = (
    <TooltipProvider>
      {convex ? (
        <ConvexAuthProvider client={convex}>
          <Outlet />
        </ConvexAuthProvider>
      ) : (
        <ConvexSetupRequired />
      )}
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {app}
    </ThemeProvider>
  );
}

function ConvexSetupRequired() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Zypp setup required
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Connect the team planner backend
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Run the project command once. Convex will create or connect the personal-team
          project and write VITE_CONVEX_URL automatically.
        </p>
      </section>
    </main>
  );
}
