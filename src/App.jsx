// ─── App: routes and guards ─────────────────────────────────────────────────
// Login → Personalised dashboard → Training module → Assessment → Scoreboard.
//
// Guards, all derived from the signed-in user the backend returns:
//   • signed out          → /login (remembers where you were going)
//   • employee on /admin  → /dashboard;  admin on employee pages → /admin
//   • assessment running  → /assessment, whatever URL is asked for. Nothing
//     else (training module included) renders until it's submitted.
//   • temporary password  → the "choose a new password" screen, whatever URL.
// The server enforces every one of these rules too; these only route.

import { createMemo, onMount, Show, Switch, Match } from "solid-js";
import { Dynamic } from "solid-js/web";
import { pathname, query, navigate, matchPath, useLocation } from "./lib/router";
import { user, ready, restoreSession } from "./store/auth";
import { session } from "./store/assessment";
import { Splash, Toaster } from "./components/ui";
import NewPassword from "./pages/NewPassword";

import EmployeeShell from "./layouts/EmployeeShell";
import AdminShell from "./layouts/AdminShell";
import Login from "./pages/Login";
import Dashboard from "./pages/employee/Dashboard";
import Training from "./pages/employee/Training";
import Test from "./pages/employee/Test";
import Viewer from "./pages/employee/Viewer";
import Assessment from "./pages/employee/Assessment";
import Scoreboard from "./pages/employee/Scoreboard";
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminDepartments from "./pages/admin/Departments";
import AdminDesignations from "./pages/admin/Designations";
import AdminLocations from "./pages/admin/Locations";
import AdminMaterials from "./pages/admin/Materials";
import AdminAssessments from "./pages/admin/Assessments";
import AdminQuestionBank from "./pages/admin/QuestionBank";
import AdminResults from "./pages/admin/Results";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";

const EMPLOYEE_ROUTES = [
  ["/dashboard", Dashboard],
  ["/training", Training],
  ["/test", Test],
  ["/training/:id", Viewer],
  ["/scoreboard", Scoreboard],
  ["/scoreboard/:id", Scoreboard],
  ["/profile", Profile],
];

const ADMIN_ROUTES = [
  ["/admin", AdminOverview],
  ["/admin/users", AdminUsers],
  ["/admin/departments", AdminDepartments],
  ["/admin/designations", AdminDesignations],
  ["/admin/locations", AdminLocations],
  ["/admin/materials", AdminMaterials],
  ["/admin/materials/:id", Viewer],
  ["/admin/assessments", AdminAssessments],
  ["/admin/assessments/:id", AdminQuestionBank],
  ["/admin/results", AdminResults],
  ["/admin/profile", Profile],
];

const find = (routes, path) => {
  for (const [pattern, component] of routes) {
    const params = matchPath(pattern, path);
    if (params) return { component, params };
  }
  return null;
};

const homeFor = (u) => (u.role === "admin" ? "/admin" : "/dashboard");

function resolve(path, u, testRunning) {
  if (!u) {
    if (path === "/login") return { kind: "login" };
    const full = useLocation()();
    const next = path !== "/" ? `?next=${encodeURIComponent(full)}` : "";
    return { redirect: `/login${next}` };
  }
  // An admin-issued temporary password must be replaced first (URL kept).
  if (u.mustChangePassword) return { kind: "password" };
  if (path === "/" || path === "/login") {
    const next = query().get("next");
    return { redirect: next && next.startsWith("/") && !next.startsWith("//") ? next : homeFor(u) };
  }

  if (u.role === "admin") {
    const r = find(ADMIN_ROUTES, path);
    if (r) return { kind: "admin", ...r };
    if (find(EMPLOYEE_ROUTES, path) || path === "/assessment") return { redirect: "/admin" };
    return { kind: "admin", component: NotFound, params: {} };
  }

  // Employee. A running assessment locks the whole portal.
  if (testRunning) return path === "/assessment" ? { kind: "assessment" } : { redirect: "/assessment" };
  if (path === "/assessment") return { redirect: "/test" };
  if (path.startsWith("/admin")) return { redirect: "/dashboard" };
  const r = find(EMPLOYEE_ROUTES, path);
  return r ? { kind: "employee", ...r } : { kind: "employee", component: NotFound, params: {} };
}

export default function App() {
  onMount(restoreSession);

  const route = createMemo(() => {
    // Nothing resolves (or redirects) until the saved session is restored.
    if (!ready()) return { kind: "loading" };
    const r = resolve(pathname(), user(), session.active && session.userId === user()?.id);
    // Only act on a redirect that's still current when the microtask runs.
    if (r.redirect) queueMicrotask(() => route() === r && navigate(r.redirect, { replace: true }));
    return r;
  });

  // Re-mount the page (and replay its entrance) on every path change, while
  // the shell around it stays put.
  const page = createMemo(() => ({ path: pathname(), route: route() }));
  const Page = () => (
    <Show when={page().route.component && page()} keyed>
      {(p) => (
        <div class="animate-fade-up">
          <Dynamic component={p.route.component} params={p.route.params} />
        </div>
      )}
    </Show>
  );

  return (
    <>
      <Show when={ready()} fallback={<Splash />}>
        <Switch>
          <Match when={route().kind === "login"}>
            <Login />
          </Match>
          <Match when={route().kind === "password"}>
            <NewPassword />
          </Match>
          <Match when={route().kind === "assessment"}>
            <Assessment />
          </Match>
          <Match when={route().kind === "employee"}>
            <EmployeeShell>
              <Page />
            </EmployeeShell>
          </Match>
          <Match when={route().kind === "admin"}>
            <AdminShell>
              <Page />
            </AdminShell>
          </Match>
        </Switch>
      </Show>
      <Toaster />
    </>
  );
}
