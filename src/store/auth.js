// Signed-in user, shared app-wide.
//
// Real API: the session is an httpOnly cookie set by the server — nothing
// is stored in JS. "Keep me signed in" asks the server for a persistent
// cookie. Mock mode keeps its fake token in local/sessionStorage.

import { createSignal } from "solid-js";
import * as api from "../services/auth";
import { setAuthProblemHandler } from "../services/api";
import { load, save, remove, removeWhere } from "../lib/storage";
import { bindSession, restoreRunningAttempt } from "./assessment";

const TOKEN_KEY = "acl.auth.v1";

const [user, setUser] = createSignal(null);
const [ready, setReady] = createSignal(false);

export { user, ready };
export const isAdmin = () => user()?.role === "admin";

// Mock-mode token: localStorage with "Keep me signed in", else sessionStorage.
const sessionToken = {
  get: () => {
    try {
      return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

// Real API (cookie sessions): a browser that once ran the demo build may
// still hold its mock database (sample users, answer keys) and fake token.
// None of it is used here, so it is removed on load.
if (!api.USES_TOKEN) {
  removeWhere((k) => k.startsWith("acl.mockdb") || k === TOKEN_KEY);
  sessionToken.set(null);
}

const clearLocal = () => {
  remove(TOKEN_KEY);
  sessionToken.set(null);
  bindSession(null);
  setUser(null);
};

// The server ended the session (expired, password changed elsewhere,
// account deactivated) or requires a new password.
setAuthProblemHandler((kind) => {
  if (kind === "signed-out" && user()) clearLocal();
  if (kind === "password-change" && user() && !user().mustChangePassword) setUser({ ...user(), mustChangePassword: true });
});

async function enter(me) {
  bindSession(me.id);
  setUser(me);
  if (me.role === "employee" && !me.mustChangePassword) await restoreRunningAttempt();
}

export async function restoreSession() {
  const token = load(TOKEN_KEY, null) || sessionToken.get();
  if (token || !api.USES_TOKEN) {
    try {
      await enter(await api.getMe(token));
    } catch {
      remove(TOKEN_KEY);
      sessionToken.set(null);
    }
  }
  setReady(true);
}

export async function signIn(email, password, remember = true) {
  const { token, user: me } = await api.login(email, password, remember);
  if (token) {
    if (remember) save(TOKEN_KEY, token);
    else {
      remove(TOKEN_KEY);
      sessionToken.set(token);
    }
  }
  await enter(me);
  return me;
}

export async function signOut() {
  try {
    await api.logout();
  } catch {
    /* the local sign-out still happens */
  }
  clearLocal();
  // Shared computers: drop any local copy of test answers (the server keeps
  // its autosaved copy for the next sign-in; the demo has no server copy).
  if (!api.USES_TOKEN) removeWhere((k) => k.startsWith("training.session."));
}

export const updateUser = (me) => setUser(me);

// After a forced password change the user continues straight into the app.
export async function passwordChanged(me) {
  await enter(me);
}
