import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  route("auth", "routes/auth.tsx"),
  layout("routes/app-layout.tsx", [
    index("routes/home.tsx"),
    route("calendar", "routes/calendar.tsx"),
    route("tasks", "routes/tasks.tsx"),
    route("tasks/new", "routes/task-new.tsx"),
    route("tasks/:taskId", "routes/task-detail.tsx"),
    route("tasks/:taskId/edit", "routes/task-edit.tsx"),
    route("team", "routes/team.tsx"),
    route("admin", "routes/admin.tsx"),
    route("notifications", "routes/notifications.tsx"),
    route("join/:inviteCode", "routes/join.tsx"),
  ]),
] satisfies RouteConfig;
