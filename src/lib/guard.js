// Deterrent for pages that play training videos: no right-click menu, and the
// view-source / developer-tools shortcuts (Ctrl+U, Ctrl+Shift+I/J/C, F12 and
// the Mac ⌘⌥ versions) do nothing. It only stops casual poking: the browser
// menu can still open DevTools, so it is not real protection.
//
// Call inside a component; it undoes itself when the component unmounts.

import { onCleanup } from "solid-js";

const blocked = (e) => {
  const k = e.key?.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  return (
    k === "f12" ||
    (mod && k === "u") || // view source
    (mod && k === "s") || // save page
    (mod && (e.shiftKey || e.altKey) && ["i", "j", "c"].includes(k)) // DevTools / console / inspect
  );
};

export function guardPage() {
  const onKey = (e) => {
    if (!blocked(e)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const onMenu = (e) => e.preventDefault();
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("contextmenu", onMenu, true);
  onCleanup(() => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("contextmenu", onMenu, true);
  });
}
