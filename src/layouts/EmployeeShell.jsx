// Employee chrome.
//   Desktop: top bar with logo, the four-step nav, announcements, theme and
//            the account menu.
//   Phone:   an app-style bar (page title + account) and a bottom tab bar in
//            journey order: Home → Training → Test → Results.

import { createResource, createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { House, BookOpen, ClipboardCheck, Trophy, Bell, LogOut, Megaphone, ChevronDown, Moon, Sun } from "lucide-solid";
import { Link, isActive, navigate, pathname } from "../lib/router";
import { cx, fmtRelative } from "../lib/format";
import { user, signOut } from "../store/auth";
import { dark, toggleTheme } from "../store/theme";
import { Logo, ThemeToggle, Avatar, Menu, MenuItem } from "../components/ui";
import { getAnnouncements } from "../services/training";

const NAV = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/training", label: "Training", icon: BookOpen },
  { href: "/test", label: "Test", icon: ClipboardCheck },
  { href: "/scoreboard", label: "Results", icon: Trophy },
];

// Title shown in the phone app bar.
const pageTitle = () => {
  const p = pathname();
  if (p.startsWith("/training/")) return "Training";
  return NAV.find((n) => isActive(n.href))?.label ?? "Aajneeti";
};

function Announcements() {
  const [news] = createResource(getAnnouncements);
  const [seen, setSeen] = createSignal(false);
  return (
    <Menu
      align="center"
      trigger={(open, toggle) => (
        <button
          class="relative grid place-items-center w-10 h-10 rounded-xl text-muted hover:text-ink hover:bg-sunken transition"
          aria-label="Announcements"
          onClick={() => {
            toggle();
            setSeen(true);
          }}
        >
          <Bell size={19} />
          <Show when={!seen() && news()?.length}>
            <span class="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-lime-400 ring-2 ring-surface" />
          </Show>
        </button>
      )}
    >
      <div class="w-[320px] max-w-[calc(100vw-2rem)]">
        <p class="px-3 pt-2 pb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Announcements</p>
        <For each={news()}>
          {(a) => (
            <div class="flex gap-3 px-3 py-2.5 rounded-xl hover:bg-sunken/60">
              <span class="grid place-items-center shrink-0 w-8 h-8 rounded-lg bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-300">
                <Megaphone size={15} />
              </span>
              <div class="min-w-0">
                <p class="text-[14px] font-semibold leading-snug">{a.title}</p>
                <p class="mt-0.5 text-[13px] text-muted line-clamp-3">{a.body}</p>
                <p class="mt-1 text-[12px] text-muted/80">
                  {a.author} · {fmtRelative(a.createdAt)}
                </p>
              </div>
            </div>
          )}
        </For>
      </div>
    </Menu>
  );
}

function Account(props) {
  const out = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
  return (
    <Menu
      align="center"
      trigger={(open, toggle) => (
        <button
          onClick={toggle}
          class={cx("flex items-center gap-2.5 h-11 pl-1 pr-1 md:pr-2.5 rounded-xl transition", open() ? "bg-sunken" : "hover:bg-sunken/70")}
          aria-label="Account menu"
        >
          <Avatar name={user()?.name} size={props.compact ? 34 : 36} />
          <span class="hidden md:grid text-left leading-tight">
            <span class="text-[14px] font-semibold max-w-[150px] truncate">{user()?.name}</span>
            <span class="text-[12px] text-muted max-w-[150px] truncate">{user()?.designation?.title ?? "Employee"}</span>
          </span>
          <ChevronDown size={16} class={cx("hidden md:block text-muted transition-transform", open() && "rotate-180")} />
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
          <Show when={user()?.department}>
            <span class="badge badge-plum">{user()?.department?.name}</span>
          </Show>
          <span class="badge badge-outline">{user()?.designation?.title ?? "Employee"}</span>
        </div>
        <div class="h-px bg-line mx-1.5 my-1" />
        {/* Phones have no room for the theme button in the bar. */}
        <div class="md:hidden">
          <MenuItem icon={dark() ? <Sun size={16} /> : <Moon size={16} />} onClick={toggleTheme}>
            {dark() ? "Light mode" : "Dark mode"}
          </MenuItem>
        </div>
        <MenuItem icon={<LogOut size={16} />} danger onClick={out}>
          Sign out
        </MenuItem>
      </div>
    </Menu>
  );
}

export default function EmployeeShell(props) {
  return (
    <div class="min-h-screen flex flex-col">
      {/* Desktop / tablet bar */}
      <header class="hidden md:block sticky top-0 z-50 border-b border-line/80 bg-canvas/85 backdrop-blur-xl backdrop-saturate-150">
        <div class="max-w-[1320px] mx-auto h-[76px] px-6 flex items-center justify-between gap-4">
          <Link href="/dashboard" class="shrink-0" aria-label="Home">
            <Logo />
          </Link>
          <nav class="flex items-center gap-1 p-1 rounded-2xl bg-surface/70 border border-line">
            <For each={NAV}>
              {(n) => (
                <Link
                  href={n.href}
                  class={cx(
                    "inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[14px] font-semibold transition",
                    isActive(n.href) ? "bg-plum-700 text-white dark:bg-lime-400 dark:text-plum-950" : "text-muted hover:text-ink",
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
            <Announcements />
            <ThemeToggle />
            <Account />
          </div>
        </div>
      </header>

      {/* Phone app bar */}
      <header class="md:hidden sticky top-0 z-50 bg-canvas/90 backdrop-blur-xl border-b border-line/70 pt-[env(safe-area-inset-top)]">
        <div class="h-14 px-4 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <img src="/aajneeti-favicon.png" alt="" class="w-8 h-8 rounded-lg object-contain" />
            <h1 class="text-[18px] font-semibold truncate">{pageTitle()}</h1>
          </div>
          <div class="flex items-center gap-0.5">
            <Announcements />
            <Account compact />
          </div>
        </div>
      </header>

      <main class="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 pt-4 sm:pt-8 pb-[calc(92px+env(safe-area-inset-bottom))] md:pb-14">
        {props.children}
      </main>

      <footer class="hidden md:block border-t border-line/70">
        <div class="max-w-[1320px] mx-auto px-6 py-5 flex items-center justify-between text-[13px] text-muted">
          <span>© {new Date().getFullYear()} Aajneeti Connect Ltd</span>
          <span>Need help? Contact your HR or training admin.</span>
        </div>
      </footer>

      {/* Phone tab bar */}
      <nav class="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface/95 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div class="grid grid-cols-4 h-[64px]">
          <For each={NAV}>
            {(n) => (
              <Link
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                class={cx(
                  "flex flex-col items-center justify-center gap-1 text-[12px] font-semibold transition active:scale-95",
                  isActive(n.href) ? "text-plum-700 dark:text-lime-300" : "text-muted",
                )}
              >
                <span class={cx("grid place-items-center w-14 h-8 rounded-full transition", isActive(n.href) && "bg-plum-100 dark:bg-lime-400/15")}>
                  <Dynamic component={n.icon} size={20} stroke-width={isActive(n.href) ? 2.25 : 1.75} />
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
