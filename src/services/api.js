// Central API client. Every backend call goes through here: one base URL,
// the session cookie (credentials: "include"), JSON in/out and one error
// shape. Errors are thrown as ApiError with the server's safe message.

export const API_URL = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// store/auth.js registers what to do when the session ends or a password
// change is required, without services importing the store.
let onAuthProblem = () => {};
export const setAuthProblemHandler = (fn) => (onAuthProblem = fn);

export async function request(method, path, { body, form, query, raw } = {}) {
  let url = `${API_URL}${path}`;
  if (query) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    if ([...qs].length) url += `?${qs}`;
  }
  const init = { method, credentials: "include", headers: { Accept: "application/json" } };
  if (form) init.body = form;
  else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the server. Check your connection and try again.");
  }
  if (raw && res.ok) return res;

  const json = await res.json().catch(() => null);
  if (res.ok && json?.ok) return json.data;
  // No API-shaped reply: the dev proxy or a gateway answered because the API is down.
  if (!json && res.status >= 500) {
    throw new ApiError(res.status, "NETWORK", "Can't reach the server. Make sure the API is running, then try again.");
  }

  const err = json?.error ?? {};
  const e = new ApiError(res.status, err.code ?? "ERROR", err.message ?? "Something went wrong. Please try again.", err.details);
  if (res.status === 401 && path !== "/auth/login") onAuthProblem("signed-out", e);
  if (err.code === "PASSWORD_CHANGE_REQUIRED") onAuthProblem("password-change", e);
  throw e;
}

export const get = (path, query) => request("GET", path, { query });
export const post = (path, body) => request("POST", path, { body });
export const patch = (path, body) => request("PATCH", path, { body });
export const put = (path, body) => request("PUT", path, { body });
export const del = (path) => request("DELETE", path);
export const upload = (path, form) => request("POST", path, { form });

// Absolute URL for links / iframes (PDFs, certificates) — same origin, so the
// session cookie goes with them.
export const fileUrl = (path) => (path?.startsWith("/api/") ? `${API_URL.replace(/\/api\/v1$/, "")}${path}` : path);
