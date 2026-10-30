// "light" | "dark" | "system". index.html applies it before first paint.
import { createSignal } from "solid-js";

const media = window.matchMedia("(prefers-color-scheme: dark)");
const read = () => {
  try {
    return localStorage.getItem("theme") || "light";
  } catch {
    return "light";
  }
};

const [theme, setThemeSignal] = createSignal(read());
const [dark, setDark] = createSignal(document.documentElement.classList.contains("dark"));
export { theme, dark };

function apply(t) {
  const d = t === "dark" || (t === "system" && media.matches);
  document.documentElement.classList.toggle("dark", d);
  setDark(d);
}

media.addEventListener?.("change", () => theme() === "system" && apply("system"));

export function setTheme(t) {
  setThemeSignal(t);
  try {
    localStorage.setItem("theme", t);
  } catch {
    /* won't persist */
  }
  apply(t);
}

export const toggleTheme = () => setTheme(dark() ? "light" : "dark");
