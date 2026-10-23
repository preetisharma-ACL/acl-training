// Employee chrome: glass top bar with the journey nav, notifications and the
// profile menu; a bottom tab bar on phones.

import { createResource, createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { LayoutDashboard, BookOpen, Trophy, UserRound, Bell, LogOut, Settings, Megaphone } from "lucide-solid";
import { Link, isActive, navigate } from "../lib/router";
import { cx, fmtRelative } from "../lib/format";
import { user, signOut } from "../store/auth";
import { Logo, ThemeToggle, Avatar, Menu, MenuItem } from "../components/ui";
import { getAnnouncements } from "../services/training";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/training", label: "Training", icon: BookOpen },
  { href: "/scoreboard", label: "Scoreboard", icon: Trophy },
];

export default function EmployeeShell(props) {
  const [news] = createResource(getAnnouncements);
  const [seen, setSeen] = createSignal(false);
  const out = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div class="min-h-screen flex flex-col">
      <header class="sticky top-0 z-50 border-b border-line/80 bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
        <div class="max-w-[1320px] mx-auto h-[68px] px-4 sm:px-6 flex items-center justify-between gap-4">
          <Link href="/dashboard" class="shrink-0" aria-label="Aajneeti Academy home">
            <Logo />
          </Link>

          <nav class="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-surface/70 border border-line shadow-[0_1px_2px_rgba(47,24,53,0.04)]">
            <For each={NAV}>
              {(n) => (
                <Link
                  href={n.href}
                  class={cx(
                    "inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold transition",
                    isActive(n.href)
                      ? "bg-plum-700 text-white shadow-[0_4px_12px_-4px_rgba(84,44,95,0.6)] dark:bg-lime-400 dark:text-plum-950"
                      : "text-muted hover:text-ink",
                  )}
                  aria-current={isActive(n.href) ? "page" : undefined}
                >
                  <Dynamic component={n.icon} size={15} />
                  {n.label}
                </Link>
              )}
            </For>
          </nav>

          <div class="flex items-center gap-1.5">
            <Menu
              trigger={(open, toggle) => (
                <button
                  class="relative grid place-items-center w-10 h-10 rounded-xl text-muted hover:text-ink hover:bg-sunken transition"
                  aria-label="Announcements"
                  onClick={() => {
                    toggle();
                    setSeen(true);
                  }}
                >
                  <Bell size={18} />
                  <Show when={!seen() && news()?.length}>
                    <span class="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-lime-400 ring-2 ring-canvas" />
                  </Show>
                </button>
              )}
            >
              <div class="w-[320px] max-w-[calc(100vw-2rem)]">
                <p class="px-3 pt-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Announcements</p>
                <For each={news()}>
                  {(a) => (
                    <div class="flex gap-3 px-3 py-2.5 rounded-xl hover:bg-sunken/60">
                      <span class="grid place-items-center shrink-0 w-8 h-8 rounded-lg bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-300">
                        <Megaphone size={15} />
                      </span>
                      <div class="min-w-0">
                        <p class="text-[13px] font-semibold leading-snug">{a.title}</p>
                        <p class="mt-0.5 text-xs text-muted line-clamp-2">{a.body}</p>
                        <p class="mt-1 text-[11px] text-muted/80">
                          {a.author} · {fmtRelative(a.createdAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Menu>
            <ThemeToggle />
            <Menu
              trigger={(open, toggle) => (
                <button
                  onClick={toggle}
                  class={cx(
                    "flex items-center gap-2.5 h-11 pl-1.5 pr-1.5 sm:pr-3 ml-1 rounded-2xl border transition",
                    open() ? "border-line-strong bg-surface" : "border-transparent hover:border-line hover:bg-surface",
                  )}
                  aria-label="Account menu"
                >
                  <Avatar name={user()?.name} size={34} />
                  <span class="hidden sm:grid text-left leading-tight">
                    <span class="text-[13px] font-semibold max-w-[140px] truncate">{user()?.name}</span>
                    <span class="text-[11px] text-muted max-w-[140px] truncate">{user()?.designation?.title ?? "Employee"}</span>
                  </span>
                </button>
              )}
            >
              <div class="px-3 py-2.5 mb-1 border-b border-line">
                <p class="text-[13px] font-semibold">{user()?.name}</p>
                <p class="text-xs text-muted truncate">{user()?.email}</p>
              </div>
              <MenuItem icon={<UserRound size={16} />} onClick={() => navigate("/profile")}>
                My profile
              </MenuItem>
              <MenuItem icon={<Settings size={16} />} onClick={() => navigate("/profile?tab=preferences")}>
                Preferences
              </MenuItem>
              <MenuItem icon={<LogOut size={16} />} danger onClick={out}>
                Sign out
              </MenuItem>
            </Menu>
          </div>
        </div>
      </header>

      <main class="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-28 md:pb-14">{props.children}</main>

      <footer class="hidden md:block border-t border-line/70">
        <div class="max-w-[1320px] mx-auto px-6 py-5 flex items-center justify-between text-xs text-muted">
          <span>© {new Date().getFullYear()} Aajneeti · Academy</span>
          <span>Need help? Contact your HR or training admin.</span>
        </div>
      </footer>

      {/* Phone tab bar */}
      <nav class="md:hidden fixed bottom-0 inset-x-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 bg-canvas/85 backdrop-blur-xl border-t border-line">
        <div class="grid grid-cols-4 gap-1">
          <For each={[...NAV, { href: "/profile", label: "Profile", icon: UserRound }]}>
            {(n) => (
              <Link
                href={n.href}
                class={cx(
                  "grid justify-items-center gap-1 py-1.5 rounded-xl text-[10.5px] font-semibold transition",
                  isActive(n.href) ? "text-plum-700 dark:text-lime-300" : "text-muted",
                )}
              >
                <span
                  class={cx(
                    "grid place-items-center w-11 h-7 rounded-full transition",
                    isActive(n.href) && "bg-plum-100 dark:bg-lime-400/15",
                  )}
                >
                  <Dynamic component={n.icon} size={18} />
                </span>
                {n.label}
              </Link>
            )}
          </For>
        </div>
      </nav>
    </div>
  );
}
