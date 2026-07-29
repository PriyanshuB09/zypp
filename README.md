# Zypp Robotics Team Planner

A responsive team task planner using Bun, React Router 7 in SPA mode, Vite,
strict TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, Convex Auth, Zustand,
next-themes, Lucide, and Sonner. Convex owns authentication and all persisted
team, task, checklist, preference, and notification data.

## Run from anywhere

The project registers a global Bun command on this machine:

```powershell
zypp
```

It switches to this project, installs any missing packages, starts Convex, and
starts the React Router development server.

## Project commands

```powershell
bun run dev
bun run build
bun run lint
bun run test
bun run typecheck
```

`bun run dev` starts Convex and the frontend together. Persisted application
data belongs in Convex; the Zustand store in `src/stores/ui-store.ts` is reserved
for ephemeral UI state.

## Convex

- Team: `CSP (csp4188)`
- Project: `convex-starter` (existing Convex deployment backing Zypp)
- Dashboard: https://dashboard.convex.dev/t/csp4188/convex-starter

Convex Auth uses its password provider. The development deployment includes the
team planner schema, live queries, protected mutations, deadline cron, and
notification deduplication.

## Vercel

`vercel.json` builds the React Router SPA into `build/client`, deploys the
production Convex functions first, and rewrites client routes to `index.html`.
Add the production deployment's `CONVEX_DEPLOY_KEY` as a Vercel environment
variable before the first deployment.
