// ─── UI kit ─────────────────────────────────────────────────────────────────
// Small, composable pieces used by every screen. Visual primitives that are
// pure CSS (.card, .btn-*, .badge-*, .input…) live in index.css.

import { createSignal, createEffect, onMount, onCleanup, Show, For, splitProps, children as resolveChildren } from "solid-js";
import { Portal, Dynamic } from "solid-js/web";
import { X, Sun, Moon, CircleCheck, CircleAlert, Info, Search, TriangleAlert } from "lucide-solid";
import { cx, initials } from "../lib/format";
import { dark, toggleTheme } from "../store/theme";
import { toasts, dismiss } from "../store/toast";

// ── Brand ───────────────────────────────────────────────────────────────────

export function Logo(props) {
  // onDark: always use the reversed logo (for plum backgrounds).
  return (
    <span class={cx("inline-flex items-center gap-3.5", props.class)}>
      <Show
        when={props.onDark}
        fallback={
          <>
            <img src="/logo.webp" alt="Aajneeti" class={cx("block dark:hidden w-auto object-contain", props.size || "h-9")} />
            <img src="/V2-aajneeti-logo.png" alt="Aajneeti" class={cx("hidden dark:block w-auto object-contain", props.size || "h-9")} />
          </>
        }
      >
        <img src="/V2-aajneeti-logo.png" alt="Aajneeti" class={cx("block w-auto object-contain", props.size || "h-9")} />
      </Show>
      <Show when={props.wordmark !== false}>
        <span class={cx("hidden sm:block h-9 w-px", props.onDark ? "bg-white/20" : "bg-line-strong/70")} />
        <span class="hidden sm:flex flex-col justify-center gap-[5px]">
          <span
            class={cx(
              "text-[16px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap",
              props.onDark ? "text-white" : "text-navy dark:text-white",
            )}
          >
            Aajneeti Connect Ltd
          </span>
          <span
            class={cx(
              "text-[10.5px] leading-none font-semibold uppercase tracking-[0.16em] whitespace-nowrap",
              props.onDark ? "text-white/60" : "text-plum-700 dark:text-lime-400",
            )}
          >
            {props.subtitle ?? "Training & Assessment"}
          </span>
        </span>
      </Show>
    </span>
  );
}

export function ThemeToggle(props) {
  return (
    <button
      onClick={toggleTheme}
      aria-label={dark() ? "Switch to light theme" : "Switch to dark theme"}
      title={dark() ? "Light theme" : "Dark theme"}
      class={cx(
        "grid place-items-center w-10 h-10 rounded-xl transition",
        props.onDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-muted hover:text-ink hover:bg-sunken",
      )}
    >
      <Show when={dark()} fallback={<Moon size={18} />}>
        <Sun size={18} />
      </Show>
    </button>
  );
}

// ── Avatar ──────────────────────────────────────────────────────────────────

const AVATAR_TONES = [
  "from-[#3463AF] to-[#3463AF] text-white",
  "from-[#0F766E] to-[#0F766E] text-white",
  "from-[#7C3AED] to-[#7C3AED] text-white",
  "from-[#C2410C] to-[#C2410C] text-white",
  "from-[#0F172A] to-[#0F172A] text-white",
];
const hash = (s = "") => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar(props) {
  const size = () => props.size ?? 36;
  return (
    <span
      class={cx(
        "relative inline-grid place-items-center shrink-0 rounded-full bg-gradient-to-br font-semibold select-none",
        AVATAR_TONES[hash(props.name) % AVATAR_TONES.length],
        props.ring && "ring-[3px] ring-surface",
        props.class,
      )}
      style={{ width: `${size()}px`, height: `${size()}px`, "font-size": `${Math.round(size() * 0.36)}px` }}
      aria-hidden="true"
    >
      {initials(props.name)}
      <Show when={props.status}>
        <span
          class={cx(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-surface",
            props.status === "active" ? "bg-emerald-500" : "bg-line-strong",
          )}
        />
      </Show>
    </span>
  );
}

// ── Numbers & progress ──────────────────────────────────────────────────────

// Animates from 0 to `value` once on mount (and on change).
export function CountUp(props) {
  const [n, setN] = createSignal(0);
  createEffect(() => {
    const target = Number(props.value) || 0;
    const from = n();
    const start = performance.now();
    const dur = props.duration ?? 900;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setN(from + (target - from) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    onCleanup(() => cancelAnimationFrame(raf));
  });
  return (
    <span class="tabular">
      {props.prefix}
      {n().toFixed(props.decimals ?? 0)}
      {props.suffix}
    </span>
  );
}

export function ProgressRing(props) {
  const size = () => props.size ?? 120;
  const stroke = () => props.stroke ?? 10;
  const r = () => (size() - stroke()) / 2;
  const C = () => 2 * Math.PI * r();
  const [shown, setShown] = createSignal(0);
  onMount(() => requestAnimationFrame(() => setShown(1)));
  const gid = `ring-${Math.random().toString(36).slice(2, 8)}`;
  const tone = () => props.tone ?? "lime";
  return (
    <div class={cx("relative shrink-0", props.class)} style={{ width: `${size()}px`, height: `${size()}px` }}>
      <svg viewBox={`0 0 ${size()} ${size()}`} class="w-full h-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Show
              when={tone() === "lime"}
              fallback={
                <Show
                  when={tone() !== "light"}
                  fallback={
                    <>
                      <stop offset="0%" stop-color="#FFFFFF" />
                      <stop offset="100%" stop-color="#C8D8FF" />
                    </>
                  }
                >
                <Show
                  when={tone() === "plum"}
                  fallback={
                    <>
                      <stop offset="0%" stop-color={tone() === "danger" ? "#C4364B" : "#16A34A"} />
                      <stop offset="100%" stop-color={tone() === "danger" ? "#AC2334" : "#16A34A"} />
                    </>
                  }
                >
                  <stop offset="0%" stop-color="#3463AF" />
                  <stop offset="100%" stop-color="#3463AF" />
                </Show>
                </Show>
              }
            >
              <stop offset="0%" stop-color="#86B4FF" />
              <stop offset="100%" stop-color="#86B4FF" />
            </Show>
          </linearGradient>
        </defs>
        <circle
          cx={size() / 2}
          cy={size() / 2}
          r={r()}
          fill="none"
          stroke-width={stroke()}
          class={props.trackClass ?? "stroke-sunken"}
        />
        <circle
          cx={size() / 2}
          cy={size() / 2}
          r={r()}
          fill="none"
          stroke={`url(#${gid})`}
          stroke-width={stroke()}
          stroke-linecap="round"
          stroke-dasharray={C()}
          stroke-dashoffset={C() * (1 - (shown() * Math.min(100, Math.max(0, props.value))) / 100)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div class="absolute inset-0 grid place-content-center text-center">{props.children}</div>
    </div>
  );
}

export function ProgressBar(props) {
  return (
    <div
      class={cx("h-1.5 rounded-full overflow-hidden", props.trackClass ?? "bg-sunken", props.class)}
      role="progressbar"
      aria-valuenow={Math.round(props.value)}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class={cx(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          props.tone === "plum"
            ? "bg-gradient-to-r from-plum-400 to-plum-700"
            : props.tone === "success"
              ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
              : "bg-gradient-to-r from-lime-300 to-lime-500",
        )}
        style={{ width: `${Math.min(100, Math.max(0, props.value))}%` }}
      />
    </div>
  );
}

// ── Cards & layout ──────────────────────────────────────────────────────────

const STAT_TONES = {
  plum: "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200",
  lime: "bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  danger: "bg-crimson-50 text-crimson-600 dark:bg-crimson-500/15 dark:text-crimson-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  neutral: "bg-sunken text-ink-2",
};

export function IconTile(props) {
  return (
    <span
      class={cx(
        "grid place-items-center shrink-0 rounded-xl",
        STAT_TONES[props.tone || "plum"],
        props.size === "lg" ? "w-12 h-12" : props.size === "sm" ? "w-8 h-8 rounded-lg" : "w-10 h-10",
        props.class,
      )}
    >
      {props.children}
    </span>
  );
}

export function StatCard(props) {
  return (
    <div class={cx("card p-5 grid gap-3 relative overflow-hidden", props.class)}>
      <div class="flex items-start justify-between gap-3">
        <IconTile tone={props.tone}>{props.icon}</IconTile>
        <Show when={props.trend != null}>
          <span class={cx("badge", props.trend >= 0 ? "badge-success" : "badge-danger")}>
            {props.trend >= 0 ? "▲" : "▼"} {Math.abs(props.trend)}%
          </span>
        </Show>
        <Show when={props.corner}>{props.corner}</Show>
      </div>
      <div>
        <p class="text-[13.5px] font-medium text-muted">{props.label}</p>
        <p class="mt-0.5 text-[26px] leading-tight font-semibold tracking-[-0.02em] tabular">{props.value}</p>
        <Show when={props.sub}>
          <p class="mt-1 text-[13px] text-muted">{props.sub}</p>
        </Show>
      </div>
    </div>
  );
}

export function PageHeader(props) {
  return (
    <div class={cx("flex flex-wrap items-end justify-between gap-4", props.class)}>
      <div class="min-w-0">
        <Show when={props.kicker}>
          <p class="kicker mb-2">{props.kicker}</p>
        </Show>
        <h1 class="text-[26px] sm:text-[30px] leading-[1.15] font-semibold tracking-[-0.025em]">{props.title}</h1>
        <Show when={props.subtitle}>
          <p class="mt-2 max-w-2xl text-[15.5px] text-muted">{props.subtitle}</p>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex flex-wrap items-center gap-2.5">{props.actions}</div>
      </Show>
    </div>
  );
}

export function SectionTitle(props) {
  return (
    <div class={cx("flex items-center justify-between gap-3", props.class)}>
      <div class="min-w-0">
        <h2 class="text-[16px] font-semibold tracking-[-0.01em]">{props.title}</h2>
        <Show when={props.subtitle}>
          <p class="text-[13.5px] text-muted mt-0.5">{props.subtitle}</p>
        </Show>
      </div>
      <Show when={props.action}>{props.action}</Show>
    </div>
  );
}

export function EmptyState(props) {
  return (
    <div class={cx("grid justify-items-center gap-3 px-6 py-12 text-center", props.class)}>
      <span class="grid place-items-center w-14 h-14 rounded-2xl bg-sunken text-muted">{props.icon}</span>
      <h3 class="text-[16px] font-semibold">{props.title}</h3>
      <Show when={props.children}>
        <p class="max-w-sm text-[14.5px] text-muted">{props.children}</p>
      </Show>
      <Show when={props.action}>
        <div class="mt-1">{props.action}</div>
      </Show>
    </div>
  );
}

export function Skeleton(props) {
  return <div class={cx("skeleton", props.class)} style={props.style} />;
}

// ── Form controls ───────────────────────────────────────────────────────────

export function Field(props) {
  return (
    <div class={props.class}>
      <Show when={props.label}>
        <label for={props.for} class="label">
          {props.label}
          <Show when={props.optional}>
            <span class="ml-1 font-normal text-muted">(optional)</span>
          </Show>
        </label>
      </Show>
      {props.children}
      <Show when={props.error} fallback={<Show when={props.hint}><p class="hint">{props.hint}</p></Show>}>
        <p class="error-text">{props.error}</p>
      </Show>
    </div>
  );
}

export function SearchInput(props) {
  const [local, rest] = splitProps(props, ["class", "value", "onInput"]);
  return (
    <div class={cx("relative", local.class)}>
      <Search size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        type="search"
        class="input pl-10"
        value={local.value}
        onInput={(e) => local.onInput(e.currentTarget.value)}
        {...rest}
      />
    </div>
  );
}

export function Toggle(props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      class={cx(
        "relative inline-flex shrink-0 w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50",
        props.checked ? "bg-plum-700 dark:bg-lime-400" : "bg-line-strong",
      )}
    >
      <span
        class={cx(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200",
          props.checked && "translate-x-5",
          props.checked && "dark:bg-plum-950",
        )}
      />
    </button>
  );
}

// Pill segmented control / tabs.
export function Tabs(props) {
  return (
    <div
      role="tablist"
      class={cx("inline-flex items-center gap-1 p-1 rounded-xl bg-sunken/80 border border-line max-w-full overflow-x-auto no-scrollbar", props.class)}
    >
      <For each={props.tabs}>
        {(t) => {
          const on = () => props.value === t.id;
          return (
            <button
              role="tab"
              aria-selected={on()}
              onClick={() => props.onChange(t.id)}
              class={cx(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[14px] font-semibold whitespace-nowrap transition",
                on() ? "bg-surface text-ink shadow-[0_1px_3px_rgba(47,24,53,0.12)]" : "text-muted hover:text-ink",
              )}
            >
              <Show when={t.icon}>
                <Dynamic component={t.icon} size={14} />
              </Show>
              {t.label}
              <Show when={t.count != null}>
                <span class={cx("px-1.5 rounded-md text-[12px] tabular", on() ? "bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-300" : "bg-line/60")}>
                  {t.count}
                </span>
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}

// ── Overlays ────────────────────────────────────────────────────────────────

function useEscape(fn) {
  onMount(() => {
    const onKey = (e) => e.key === "Escape" && fn?.();
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });
}

function useScrollLock() {
  onMount(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => (document.body.style.overflow = prev));
  });
}

// Render inside <Show when={open()}>. size: "sm" | "md" | "lg".
export function Modal(props) {
  useEscape(() => props.onClose?.());
  useScrollLock();
  const width = () => ({ sm: "max-w-[420px]", md: "max-w-[520px]", lg: "max-w-[720px]" })[props.size || "md"];
  return (
    <Portal>
      <div
        class="fixed inset-0 z-[1100] grid items-end sm:place-items-center sm:p-4 bg-plum-950/50 backdrop-blur-[6px] animate-fade-in"
        onClick={(e) => e.target === e.currentTarget && props.onClose?.()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={props.labelledBy}
          class={cx(
            // Phones: a sheet that slides up from the bottom. Larger screens: a centred dialog.
            "w-full max-h-[90vh] sm:max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin rounded-t-[24px] sm:rounded-[22px] bg-surface border border-line shadow-float animate-sheet sm:animate-pop pb-[env(safe-area-inset-bottom)] sm:pb-0",
            width(),
            props.class,
          )}
        >
          <div class="sm:hidden flex justify-center pt-2.5" aria-hidden="true">
            <span class="w-10 h-1.5 rounded-full bg-line-strong" />
          </div>
          <Show when={props.title}>
            <div class="flex items-start justify-between gap-4 px-5 sm:px-6 pt-4 sm:pt-6">
              <div>
                <h2 id={props.labelledBy} class="text-lg font-semibold">{props.title}</h2>
                <Show when={props.subtitle}>
                  <p class="mt-1 text-[14px] text-muted">{props.subtitle}</p>
                </Show>
              </div>
              <Show when={props.onClose}>
                <button class="btn btn-ghost btn-icon -mr-2 -mt-1 w-9 h-9" onClick={props.onClose} aria-label="Close">
                  <X size={18} />
                </button>
              </Show>
            </div>
          </Show>
          <div class={cx(props.title ? "px-5 sm:px-6 pt-4 pb-6" : "px-5 pt-4 pb-6 sm:p-7")}>{props.children}</div>
          <Show when={props.footer}>
            <div class="flex flex-wrap justify-end gap-2.5 px-5 sm:px-6 py-4 border-t border-line bg-sunken/40 sm:rounded-b-[22px]">{props.footer}</div>
          </Show>
        </div>
      </div>
    </Portal>
  );
}

export function Drawer(props) {
  useEscape(() => props.onClose?.());
  useScrollLock();
  return (
    <Portal>
      <div class="fixed inset-0 z-[1100] flex justify-end bg-plum-950/40 backdrop-blur-[4px] animate-fade-in" onClick={(e) => e.target === e.currentTarget && props.onClose?.()}>
        <aside
          role="dialog"
          aria-modal="true"
          class={cx("flex flex-col w-full h-full bg-surface border-l border-line shadow-float animate-slide-in-right", props.width || "max-w-[520px]")}
        >
          <header class="flex items-start justify-between gap-4 px-6 py-5 border-b border-line">
            <div class="min-w-0">
              <Show when={props.kicker}>
                <p class="kicker mb-1.5">{props.kicker}</p>
              </Show>
              <h2 class="text-lg font-semibold truncate">{props.title}</h2>
              <Show when={props.subtitle}>
                <p class="mt-0.5 text-[14px] text-muted">{props.subtitle}</p>
              </Show>
            </div>
            <button class="btn btn-ghost btn-icon -mr-2 w-9 h-9" onClick={props.onClose} aria-label="Close">
              <X size={18} />
            </button>
          </header>
          <div class="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">{props.children}</div>
          <Show when={props.footer}>
            <footer class="flex flex-wrap justify-end gap-2.5 px-6 py-4 border-t border-line bg-sunken/40">{props.footer}</footer>
          </Show>
        </aside>
      </div>
    </Portal>
  );
}

export function ConfirmDialog(props) {
  const [busy, setBusy] = createSignal(false);
  const run = async () => {
    setBusy(true);
    try {
      await props.onConfirm();
      props.onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={() => !busy() && props.onClose()} size="sm" labelledBy="confirm-title">
      <div class="grid justify-items-center gap-3 text-center">
        <span
          class={cx(
            "grid place-items-center w-14 h-14 rounded-full",
            props.tone === "danger" ? "bg-crimson-50 text-crimson-600 dark:bg-crimson-500/15 dark:text-crimson-300" : "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200",
          )}
        >
          {props.icon ?? <TriangleAlert size={24} />}
        </span>
        <h2 id="confirm-title" class="text-lg font-semibold">{props.title}</h2>
        <p class="text-[14.5px] text-muted">{props.message}</p>
        <div class="grid grid-cols-2 gap-2.5 w-full mt-2">
          <button class="btn btn-secondary" disabled={busy()} onClick={props.onClose}>
            Cancel
          </button>
          <button class={cx("btn", props.tone === "danger" ? "btn-danger-solid" : "btn-primary")} disabled={busy()} onClick={run}>
            {busy() ? "Working…" : props.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Click-outside dropdown menu. `trigger` receives (open, toggle). The panel
// is portalled with fixed positioning so scrolling containers (tables)
// can't clip it.
export function Menu(props) {
  const [open, setOpen] = createSignal(false);
  const [pos, setPos] = createSignal(null);
  let root;
  let panel;
  const place = () => {
    const r = root.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < 260 && r.top > below;
    // Opened from a sticky header: drop below the header, never over its edge.
    const header = root.closest("header")?.getBoundingClientRect();
    const top = Math.max(r.bottom + 8, header ? header.bottom + 8 : 0);
    setPos({
      top: up ? undefined : `${top}px`,
      bottom: up ? `${window.innerHeight - r.top + 8}px` : undefined,
      left: props.align === "left" ? `${Math.max(8, r.left)}px` : undefined,
      right: props.align === "left" ? undefined : `${Math.max(8, window.innerWidth - r.right)}px`,
    });
    // align="center": centre the panel under the trigger, kept on screen.
    if (props.align === "center") {
      requestAnimationFrame(() => {
        const w = panel?.offsetWidth ?? 0;
        const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
        setPos((cur) => ({ ...cur, left: `${left}px`, right: undefined }));
      });
    }
  };
  const toggle = () => {
    if (!open()) place();
    setOpen(!open());
  };
  onMount(() => {
    const onDoc = (e) => open() && !root.contains(e.target) && !panel?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    onCleanup(() => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    });
  });
  const items = resolveChildren(() => props.children);
  return (
    <div ref={root} class={cx("relative", props.class)}>
      {props.trigger(open, toggle)}
      <Show when={open()}>
        <Portal>
          <div
            ref={panel}
            class="fixed z-[1150] min-w-[220px] p-1.5 rounded-2xl bg-surface border border-line shadow-float animate-pop"
            style={pos()}
            onClick={() => setOpen(false)}
          >
            {items()}
          </div>
        </Portal>
      </Show>
    </div>
  );
}

export function MenuItem(props) {
  return (
    <button
      onClick={props.onClick}
      class={cx(
        "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left text-[14px] font-medium transition",
        props.danger ? "text-crimson-600 dark:text-crimson-300 hover:bg-crimson-50 dark:hover:bg-crimson-500/10" : "text-ink-2 hover:bg-sunken hover:text-ink",
      )}
    >
      {props.icon}
      {props.children}
    </button>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────

export function Toaster() {
  const icon = (tone) =>
    tone === "error" ? <CircleAlert size={18} /> : tone === "info" ? <Info size={18} /> : <CircleCheck size={18} />;
  return (
    <Portal>
      <div class="no-print fixed z-[1300] bottom-4 right-4 left-4 sm:left-auto grid gap-2.5 sm:w-[380px]" aria-live="polite">
        <For each={toasts()}>
          {(t) => (
            <div class="flex items-start gap-3 p-3.5 pr-2.5 rounded-2xl bg-plum-950 text-white shadow-float border border-white/10 animate-toast-in">
              <span
                class={cx(
                  "grid place-items-center shrink-0 w-8 h-8 rounded-xl",
                  t.tone === "error" ? "bg-crimson-500/25 text-crimson-200" : t.tone === "info" ? "bg-white/10 text-plum-200" : "bg-lime-400/20 text-lime-300",
                )}
              >
                {icon(t.tone)}
              </span>
              <div class="flex-1 min-w-0 pt-0.5">
                <Show when={t.title}>
                  <p class="text-[14px] font-semibold">{t.title}</p>
                </Show>
                <p class={cx("text-[14px]", t.title ? "text-white/70" : "text-white/90")}>{t.message}</p>
              </div>
              <button class="grid place-items-center w-7 h-7 rounded-lg text-white/50 hover:text-white hover:bg-white/10" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}
        </For>
      </div>
    </Portal>
  );
}

// Full-screen loader used while the session is restored.
export function Splash() {
  return (
    <div class="fixed inset-0 grid place-items-center hero-aurora grain">
      <div class="relative grid justify-items-center gap-6 animate-fade-in">
        <Logo onDark wordmark={false} size="h-10" />
        <div class="w-40 h-1 rounded-full bg-white/10 overflow-hidden">
          <div class="h-full w-1/3 rounded-full bg-lime-400" style={{ animation: "splash 1.1s ease-in-out infinite" }} />
        </div>
      </div>
      <style>{`@keyframes splash { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
}
