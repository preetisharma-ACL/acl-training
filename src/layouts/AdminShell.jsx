// Admin console chrome: deep-plum sidebar with grouped navigation, a slim top
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
  UserRound,
  RefreshCw,
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
  if (p === "/admin/profile") return "My profile";
  return [...ALL].reverse().find((i) => (i.exact ? p === i.href : p === i.href || p.startsWith(i.href + "/")))?.label ?? "Admin";
};

function Sidebar(props) {
  return (
    <div class="relative flex flex-col h-full hero-aurora-soft grain text-white overflow-hidden">
      {/* Brand: centred logo, product name, divider */}
      <div class="relative z-[1] px-6 pt-7 pb-5">
        <Show when={props.onClose}>
          <button class="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-lg text-white/70 hover:bg-white/10" onClick={props.onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </Show>
        <Link href="/admin" aria-label="ACL Training home" class="flex flex-col items-center">
          <img src="/V2-aajneeti-logo.png" alt="Aajneeti" class="h-14 w-auto" />
          <span class="flex items-center gap-2.5 mt-3">
            <span class="w-6 h-px bg-lime-300/70" />
            <span class="text-[12px] font-semibold uppercase tracking-[0.24em] text-lime-300">ACL Training</span>
          </span>
        </Link>
        <div class="mt-5 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <nav class="relative z-[1] flex-1 overflow-y-auto no-scrollbar px-3 pb-4">
        <For each={GROUPS}>
          {(g) => (
            <div class="mb-5">
              <p class="px-3 mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.2em] text-white/35">{g.label}</p>
              <For each={g.items}>
                {(i) => {
                  const on = () => isActive(i.href, { exact: i.exact });
                  return (
                    <Link
                      href={i.href}
                      onClick={() => props.onClose?.()}
                      class={cx(
                        "relative flex items-center gap-3 h-10 px-3 mb-0.5 rounded-xl text-[13.5px] font-normal transition",
                        on() ? "bg-white/[0.1] text-white font-medium" : "text-white/70 hover:text-white hover:bg-white/[0.05]",
                      )}
                      aria-current={on() ? "page" : undefined}
                    >
                      <Show when={on()}>
                        <span class="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-lime-400 shadow-[0_0_12px_rgba(199,232,72,0.7)]" />
                      </Show>
                      <Dynamic component={i.icon} size={17} stroke-width={1.6} class={on() ? "text-lime-300" : "text-white/60"} />
                      {i.label}
                    </Link>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </nav>

      <div class="relative z-[1] m-3 p-3 rounded-2xl glass flex items-center gap-3">
        <Avatar name={user()?.name} size={38} />
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-medium truncate">{user()?.name}</p>
          <p class="text-[11px] text-white/55 truncate">{user()?.adminTitle}</p>
        </div>
        <button
          class="grid place-items-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
          onClick={props.onSignOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={17} />
        </button>
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
        <Sidebar onSignOut={out} />
      </aside>

      <Show when={mobileOpen()}>
        <div class="lg:hidden fixed inset-0 z-[90] bg-plum-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)}>
          <div class="w-[280px] h-full animate-[slide-in-left_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
            <Sidebar onClose={() => setMobileOpen(false)} onSignOut={out} />
          </div>
        </div>
      </Show>

      <header class="sticky top-0 z-30 h-16 flex items-center justify-between gap-3 px-4 sm:px-8 bg-canvas/80 backdrop-blur-xl border-b border-line/80">
        <div class="flex items-center gap-3 min-w-0">
          <button class="lg:hidden btn btn-ghost btn-icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon size={19} />
          </button>
          <div class="min-w-0">
            <p class="hidden sm:block text-[11px] font-medium text-muted">Admin console</p>
            <p class="text-[15px] font-semibold truncate">{currentTitle()}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <ThemeToggle />
          <Menu
            trigger={(open, toggle) => (
              <button onClick={toggle} class="flex items-center gap-2 h-10 pl-1 pr-1 sm:pr-2.5 rounded-xl hover:bg-surface border border-transparent hover:border-line transition" aria-label="Account menu">
                <Avatar name={user()?.name} size={32} />
                <span class="hidden sm:block text-[13px] font-semibold">{user()?.name}</span>
              </button>
            )}
          >
            <div class="px-3 py-2.5 mb-1 border-b border-line">
              <p class="text-[13px] font-semibold">{user()?.name}</p>
              <p class="text-xs text-muted truncate">{user()?.email}</p>
            </div>
            <MenuItem icon={<UserRound size={16} />} onClick={() => navigate("/admin/profile")}>
              My profile
            </MenuItem>
            <MenuItem icon={<RefreshCw size={16} />} onClick={() => setConfirmReset(true)}>
              Reset demo data
            </MenuItem>
            <MenuItem icon={<LogOut size={16} />} danger onClick={out}>
              Sign out
            </MenuItem>
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
