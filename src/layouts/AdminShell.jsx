// Admin console chrome: light sidebar with one menu list, a slim top
// bar, and an off-canvas sidebar on small screens.

import { createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  LayoutDashboard,
  Users,
  Building2,
  BadgeCheck,
  Library,
  ClipboardList,
  ChartColumn,
  LogOut,
  Menu as MenuIcon,
  X,
  RefreshCw,
  ChevronDown,
} from "lucide-solid";
import { Link, isActive, navigate, pathname } from "../lib/router";
import { cx } from "../lib/format";
import { user, signOut } from "../store/auth";
import { toast } from "../store/toast";
import { ThemeToggle, Avatar, Menu, MenuItem, ConfirmDialog } from "../components/ui";
import { resetDemoData } from "../services/admin";

const GROUPS = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  {
    label: "People",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/departments", label: "Departments", icon: Building2 },
      { href: "/admin/designations", label: "Designations", icon: BadgeCheck },
    ],
  },
  {
    label: "Learning",
    items: [
      { href: "/admin/materials", label: "Training materials", icon: Library },
      { href: "/admin/assessments", label: "Assessments", icon: ClipboardList },
    ],
  },
  { label: "Insights", items: [{ href: "/admin/results", label: "Employee results", icon: ChartColumn }] },
];

const ALL = GROUPS.flatMap((g) => g.items);
const currentTitle = () => {
  const p = pathname();
  return [...ALL].reverse().find((i) => (i.exact ? p === i.href : p === i.href || p.startsWith(i.href + "/")))?.label ?? "Admin";
};

// Light sidebar, laid out like the Aajneeti reporting dashboard: centred
// colour logo, product label, one plain menu, credit footer, and a thin
// plum → lime accent line on the right edge.
function Sidebar(props) {
  return (
    <div class="relative flex flex-col h-full bg-gradient-to-b from-surface via-surface to-canvas border-r border-line shadow-[1px_0_2px_rgba(47,24,53,0.04),8px_0_28px_-16px_rgba(47,24,53,0.16)]">
      <span class="absolute top-[18%] bottom-[30%] right-0 w-[3px] rounded-l-full bg-gradient-to-b from-plum-600 via-plum-400 to-lime-400" />

      <div class="relative px-6 pt-7 pb-5">
        <Show when={props.onClose}>
          <button class="absolute top-3 right-3 btn btn-ghost btn-icon !w-9 !h-9" onClick={props.onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </Show>
        <Link href="/admin" aria-label="ACL Training & Assessment home" class="flex flex-col items-center">
          <img src="/logo.webp" alt="Aajneeti" class="block dark:hidden h-14 w-auto" />
          <img src="/V2-aajneeti-logo.png" alt="Aajneeti" class="hidden dark:block h-14 w-auto" />
          <span class="mt-3 text-[12px] font-bold uppercase tracking-[0.14em] text-plum-700 dark:text-lime-300 whitespace-nowrap">ACL Training &amp; Assessment</span>
        </Link>
        <div class="mt-5 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />
      </div>

      <nav class="flex-1 overflow-y-auto no-scrollbar px-3 pb-4 grid content-start gap-1">
        <For each={ALL}>
          {(i) => {
            const on = () => isActive(i.href, { exact: i.exact });
            return (
              <Link
                href={i.href}
                onClick={() => props.onClose?.()}
                aria-current={on() ? "page" : undefined}
                class={cx(
                  "flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] transition",
                  on()
                    ? "bg-plum-50 text-plum-700 font-semibold shadow-[inset_0_0_0_1.5px_rgba(168,119,178,0.55)] dark:bg-lime-400/10 dark:text-lime-300 dark:shadow-[inset_0_0_0_1.5px_rgba(199,232,72,0.35)]"
                    : "text-ink-2 hover:bg-sunken/70 hover:text-ink",
                )}
              >
                <Dynamic component={i.icon} size={18} stroke-width={1.75} class={on() ? "" : "text-muted"} />
                {i.label}
              </Link>
            );
          }}
        </For>
      </nav>

      <div class="px-5 py-4 border-t border-line text-[12px] leading-relaxed text-muted">
        <p class="font-medium">Developed by Aajneeti Connect Ltd.</p>
        <p>© {new Date().getFullYear()} All rights reserved.</p>
      </div>
    </div>
  );
}

export default function AdminShell(props) {
  const [mobileOpen, setMobileOpen] = createSignal(false);
  const [confirmReset, setConfirmReset] = createSignal(false);
  const out = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div class="min-h-screen lg:pl-[272px]">
      <aside class="hidden lg:block fixed inset-y-0 left-0 w-[272px] z-40">
        <Sidebar />
      </aside>

      <Show when={mobileOpen()}>
        <div class="lg:hidden fixed inset-0 z-[90] bg-plum-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)}>
          <div class="w-[280px] h-full animate-[slide-in-left_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      </Show>

      <header class="sticky top-0 z-30 h-16 flex items-center justify-between gap-3 px-4 sm:px-8 bg-canvas/80 backdrop-blur-xl border-b border-line/80">
        <div class="flex items-center gap-3 min-w-0">
          <button class="lg:hidden btn btn-ghost btn-icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon size={19} />
          </button>
          <div class="min-w-0">
            <p class="hidden sm:block text-[12px] font-medium text-muted">Admin console</p>
            <p class="text-[16px] font-semibold truncate">{currentTitle()}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <ThemeToggle />
          <Menu
            align="center"
            trigger={(open, toggle) => (
              <button onClick={toggle} class={cx("flex items-center gap-2 h-10 pl-1 pr-1 sm:pr-2 rounded-xl transition", open() ? "bg-sunken" : "hover:bg-sunken/70")} aria-label="Account menu">
                <Avatar name={user()?.name} size={32} />
                <span class="hidden sm:block text-[14px] font-semibold">{user()?.name}</span>
                <ChevronDown size={16} class={cx("hidden sm:block text-muted transition-transform", open() && "rotate-180")} />
              </button>
            )}
          >
<div class="w-[290px] max-w-[calc(100vw-2rem)]">
                <div class="flex items-center gap-3 p-3">
                  <Avatar name={user()?.name} size={44} />
                  <div class="min-w-0">
                    <p class="text-[15px] font-semibold truncate">{user()?.name}</p>
                    <p class="text-[13px] text-muted truncate">{user()?.email}</p>
                  </div>
                </div>
                <div class="mx-3 mb-2 flex flex-wrap gap-1.5">
                  <span class="badge badge-lime">{user()?.adminTitle ?? "Admin"}</span>
                </div>
                <div class="h-px bg-line mx-1.5 my-1" />
              <MenuItem icon={<RefreshCw size={16} />} onClick={() => setConfirmReset(true)}>
                Reset demo data
              </MenuItem>
              <MenuItem icon={<LogOut size={16} />} danger onClick={out}>
                Sign out
              </MenuItem>
            </div>
          </Menu>
        </div>
      </header>

      <main class="px-4 sm:px-8 py-6 sm:py-8 max-w-[1440px]">{props.children}</main>

      <Show when={confirmReset()}>
        <ConfirmDialog
          title="Reset demo data?"
          message="Every change made in this browser — users, materials, questions and results — goes back to the original sample data."
          confirmLabel="Reset data"
          tone="danger"
          icon={<RefreshCw size={22} />}
          onClose={() => setConfirmReset(false)}
          onConfirm={async () => {
            await resetDemoData();
            toast("Demo data restored. Reloading…");
            setTimeout(() => window.location.reload(), 700);
          }}
        />
      </Show>
      <style>{`@keyframes slide-in-left { from { transform: translateX(-100%); } to { transform: none; } }`}</style>
    </div>
  );
}
