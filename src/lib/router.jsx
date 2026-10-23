// ─── Minimal history router ─────────────────────────────────────────────────
// The portal has a handful of flat routes, so this replaces a router
// dependency: one signal holding the path, pushState/popstate, and a matcher
// for "/training/:id" style patterns. Production hosting must serve
// index.html for unknown paths (SPA fallback) — Vite dev/preview already do.

import { createSignal } from "solid-js";

const current = () => window.location.pathname + window.location.search;
const [location, setLocation] = createSignal(current());

window.addEventListener("popstate", () => setLocation(current()));

export const useLocation = () => location;
export const pathname = () => location().split("?")[0];
export const query = () => new URLSearchParams(location().split("?")[1] || "");

export function navigate(to, { replace = false, scroll = true } = {}) {
  if (to === current()) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", to);
  setLocation(current());
  if (scroll) window.scrollTo({ top: 0 });
}

// "/training/:id" vs "/training/abc" → { id: "abc" }; no match → null.
export function matchPath(pattern, path) {
  const p = pattern.split("/").filter(Boolean);
  const a = path.split("/").filter(Boolean);
  if (p.length !== a.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function isActive(href, { exact = false } = {}) {
  const path = pathname();
  return exact ? path === href : path === href || path.startsWith(href + "/");
}

// <a> that routes in-app but still opens in a new tab with ctrl/cmd-click.
export function Link(props) {
  const onClick = (e) => {
    props.onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(props.href);
  };
  return (
    <a
      href={props.href}
      class={props.class}
      classList={props.classList}
      aria-current={props["aria-current"]}
      aria-label={props["aria-label"]}
      title={props.title}
      onClick={onClick}
    >
      {props.children}
    </a>
  );
}
