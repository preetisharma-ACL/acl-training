import { createSignal } from "solid-js";

const [toasts, setToasts] = createSignal([]);
export { toasts };

let n = 0;
// tone: "success" | "error" | "info"
export function toast(message, { tone = "success", title, duration = 3600 } = {}) {
  const id = ++n;
  setToasts((t) => [...t, { id, message, tone, title }]);
  setTimeout(() => dismiss(id), duration);
}
export const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));
