// Signed-in user, shared app-wide. The token is opaque to the UI; in mock
// mode it's "mock.<userId>". When the backend lands this keeps the same API —
// only services/auth.js changes (or a session cookie replaces the token).

import { createSignal } from "solid-js";
import * as api from "../services/auth";
import { load, save, remove } from "../lib/storage";
import { bindSession } from "./assessment";

const TOKEN_KEY = "acl.auth.v1";

const [user, setUser] = createSignal(null);
const [ready, setReady] = createSignal(false);

export { user, ready };
export const isAdmin = () => user()?.role === "admin";

// "Remember me" keeps the token in localStorage; otherwise sessionStorage,
// so the sign-in ends when the browser tab closes.
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

export async function restoreSession() {
  const token = load(TOKEN_KEY, null) || sessionToken.get();
  if (token) {
    try {
      const me = await api.getMe(token);
      bindSession(me.id);
      setUser(me);
    } catch {
      remove(TOKEN_KEY);
      sessionToken.set(null);
    }
  }
  setReady(true);
}

export async function signIn(email, password, remember = true) {
  const { token, user: me } = await api.login(email, password);
  if (remember) save(TOKEN_KEY, token);
  else {
    remove(TOKEN_KEY);
    sessionToken.set(token);
  }
  bindSession(me.id);
  setUser(me);
  return me;
}

export async function signOut() {
  await api.logout();
  remove(TOKEN_KEY);
  sessionToken.set(null);
  bindSession(null);
  setUser(null);
}

export const updateUser = (me) => setUser(me);
