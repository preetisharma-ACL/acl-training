// Profile & settings, for employees and admins. Identity and organisation
// fields (name, email, department, designation) are read-only — admins and
// the backend own them. Phone, location, bio, password and preferences are
// the user's to change.

import { createSignal, createMemo, For, Show } from "solid-js";
import {
  UserRound,
  ShieldCheck,
  SlidersHorizontal,
  Lock,
  Mail,
  Phone,
  MapPin,
  Hash,
  CalendarClock,
  Building2,
  BadgeCheck,
  Laptop,
  Smartphone,
  KeyRound,
  Sun,
  Moon,
  Monitor,
  Check,
  Eye,
  EyeOff,
  Layers,
} from "lucide-solid";
import { Dynamic } from "solid-js/web";
import { query, navigate, pathname } from "../lib/router";
import { cx, fmtDate } from "../lib/format";
import { user, updateUser, isAdmin } from "../store/auth";
import { theme, setTheme } from "../store/theme";
import { toast } from "../store/toast";
import { updateProfile, changePassword } from "../services/auth";
import { Avatar, Tabs, Field, Toggle } from "../components/ui";

const LOCATIONS = ["Lucknow HQ", "Noida", "Gurugram", "Delhi", "Remote"];

export default function Profile() {
  const tab = () => query().get("tab") || "personal";
  const setTab = (t) => navigate(`${pathname()}?tab=${t}`, { replace: true, scroll: false });
  const me = () => user();

  return (
    <div class="grid gap-6 max-w-[1100px]">
      {/* Identity header */}
      <section class="card overflow-hidden">
        <div class="relative h-36 sm:h-44 hero-aurora grain">
          <div class="absolute inset-0 grid-lines" />
          <div class="absolute -top-16 right-10 w-72 h-72 rounded-full bg-lime-400/20 blur-[70px]" />
        </div>
        <div class="relative px-5 sm:px-8 pb-6">
          <div class="flex flex-wrap items-end gap-5 -mt-12 sm:-mt-14">
            <Avatar name={me().name} size={112} class="ring-[5px] ring-surface shadow-lift text-[40px]" />
            <div class="flex-1 min-w-[220px] pb-1">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-[26px] font-semibold tracking-[-0.025em]">{me().name}</h1>
                <Show when={isAdmin()}>
                  <span class="badge badge-lime">
                    <ShieldCheck size={12} /> {me().adminTitle}
                  </span>
                </Show>
              </div>
              <p class="mt-1 text-[14px] text-muted">
                <Show when={!isAdmin()} fallback="Administrator · Aajneeti Academy">
                  {me().designation?.title ?? "No designation"} · {me().department?.name ?? "Unassigned"}
                </Show>
              </p>
            </div>
            <div class="flex flex-wrap gap-2 pb-1">
              <span class="badge badge-outline px-3 py-1.5">
                <Hash size={12} /> {me().code}
              </span>
              <span class="badge badge-outline px-3 py-1.5">
                <MapPin size={12} /> {me().location}
              </span>
              <span class="badge badge-outline px-3 py-1.5">
                <CalendarClock size={12} /> Joined {fmtDate(me().joinedAt)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <Tabs
        value={tab()}
        onChange={setTab}
        tabs={[
          { id: "personal", label: "Personal info", icon: UserRound },
          { id: "security", label: "Security", icon: KeyRound },
          { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
        ]}
      />

      <div class="animate-fade-up">
        <Show when={tab() === "personal"}>
          <Personal />
        </Show>
        <Show when={tab() === "security"}>
          <Security />
        </Show>
        <Show when={tab() === "preferences"}>
          <Preferences />
        </Show>
      </div>
    </div>
  );
}

function ReadOnly(props) {
  return (
    <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-sunken/50 border border-line/70">
      <span class="grid place-items-center shrink-0 w-9 h-9 rounded-xl bg-surface border border-line text-muted">{props.icon}</span>
      <div class="min-w-0">
        <p class="text-[11.5px] text-muted">{props.label}</p>
        <p class="text-[13.5px] font-semibold truncate">{props.value || "—"}</p>
      </div>
    </div>
  );
}

function Personal() {
  const me = user();
  const [phone, setPhone] = createSignal(me.phone || "");
  const [location, setLocation] = createSignal(me.location || "");
  const [bio, setBio] = createSignal(me.bio || "");
  const [saving, setSaving] = createSignal(false);
  const dirty = createMemo(() => phone() !== (user().phone || "") || location() !== (user().location || "") || bio() !== (user().bio || ""));
  const phoneOk = () => /^[+\d][\d\s-]{7,}$/.test(phone().trim());

  const save = async (e) => {
    e.preventDefault();
    if (!phoneOk()) return;
    setSaving(true);
    try {
      updateUser(await updateProfile(me.id, { phone: phone().trim(), location: location(), bio: bio().trim() }));
      toast("Your profile has been updated.");
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <form class="card p-5 sm:p-7 grid gap-5" onSubmit={save}>
        <div>
          <h2 class="text-[16px] font-semibold">Contact details</h2>
          <p class="mt-1 text-[13px] text-muted">How colleagues and admins can reach you.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" hint="Managed by HR">
            <div class="relative">
              <input class="input pr-10" value={me.name} disabled />
              <Lock size={14} class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          </Field>
          <Field label="Work email" hint="Used to sign in">
            <div class="relative">
              <input class="input pr-10" value={me.email} disabled />
              <Mail size={14} class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          </Field>
          <Field label="Phone" for="pf-phone" error={!phoneOk() ? "Enter a valid phone number." : null}>
            <div class="relative">
              <Phone size={15} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input id="pf-phone" class={cx("input pl-10", !phoneOk() && "input-invalid")} value={phone()} onInput={(e) => setPhone(e.currentTarget.value)} />
            </div>
          </Field>
          <Field label="Work location" for="pf-loc">
            <select id="pf-loc" class="input" value={location()} onChange={(e) => setLocation(e.currentTarget.value)}>
              <For each={LOCATIONS}>{(l) => <option value={l}>{l}</option>}</For>
            </select>
          </Field>
        </div>
        <Field label="About you" for="pf-bio" optional hint={`${bio().length}/240`}>
          <textarea
            id="pf-bio"
            rows="3"
            maxlength="240"
            class="input resize-none"
            placeholder="A line about your role or what you're working on."
            value={bio()}
            onInput={(e) => setBio(e.currentTarget.value)}
          />
        </Field>
        <div class="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-line">
          <Show when={dirty()}>
            <button
              type="button"
              class="btn btn-ghost"
              onClick={() => {
                setPhone(user().phone || "");
                setLocation(user().location || "");
                setBio(user().bio || "");
              }}
            >
              Discard
            </button>
          </Show>
          <button type="submit" class="btn btn-primary" disabled={!dirty() || saving() || !phoneOk()}>
            {saving() ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <aside class="card p-5 sm:p-6 grid gap-3">
        <div>
          <h2 class="text-[16px] font-semibold">Organisation</h2>
          <p class="mt-1 text-[12.5px] text-muted flex items-center gap-1.5">
            <Lock size={12} /> Assigned by your admin — contact HR to change.
          </p>
        </div>
        <Show
          when={!isAdmin()}
          fallback={
            <>
              <ReadOnly icon={<ShieldCheck size={16} />} label="Role" value={me.adminTitle} />
              <ReadOnly icon={<Hash size={16} />} label="Employee code" value={me.code} />
            </>
          }
        >
          <ReadOnly icon={<Building2 size={16} />} label="Department" value={me.department?.name ?? "Not assigned"} />
          <ReadOnly icon={<BadgeCheck size={16} />} label="Designation" value={me.designation?.title} />
          <ReadOnly icon={<Layers size={16} />} label="Level" value={me.designation?.level} />
          <ReadOnly icon={<UserRound size={16} />} label="Department head" value={me.department?.head} />
          <ReadOnly icon={<Hash size={16} />} label="Employee code" value={me.code} />
        </Show>
      </aside>
    </div>
  );
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const STRENGTH = ["Too short", "Weak", "Fair", "Good", "Strong"];

function Security() {
  const me = user();
  const [cur, setCur] = createSignal("");
  const [next, setNext] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  const [show, setShow] = createSignal(false);
  const [touched, setTouched] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);
  const score = () => strength(next());
  const valid = () => cur() && next().length >= 8 && next() === confirm() && next() !== cur();

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!valid()) return;
    setBusy(true);
    try {
      await changePassword(me.id, cur(), next());
      toast("Your password has been changed.", { title: "Password updated" });
      setCur("");
      setNext("");
      setConfirm("");
      setTouched(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <form class="card p-5 sm:p-7 grid gap-5" onSubmit={submit} novalidate>
        <div>
          <h2 class="text-[16px] font-semibold">Change password</h2>
          <p class="mt-1 text-[13px] text-muted">Use at least 8 characters with a mix of letters, numbers and symbols.</p>
        </div>
        <Show when={error()}>
          <p class="px-3.5 py-2.5 rounded-xl text-[13px] font-medium badge-danger !flex">{error()}</p>
        </Show>
        <Field label="Current password" for="pw-cur" error={touched() && !cur() ? "Enter your current password." : null}>
          <input id="pw-cur" type={show() ? "text" : "password"} autocomplete="current-password" class="input" value={cur()} onInput={(e) => setCur(e.currentTarget.value)} />
        </Field>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="New password" for="pw-new" error={touched() && next().length < 8 ? "Use at least 8 characters." : touched() && next() === cur() && next() ? "Choose a different password." : null}>
            <div class="relative">
              <input id="pw-new" type={show() ? "text" : "password"} autocomplete="new-password" class="input pr-11" value={next()} onInput={(e) => setNext(e.currentTarget.value)} />
              <button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-ink" onClick={() => setShow(!show())} aria-label={show() ? "Hide passwords" : "Show passwords"}>
                <Show when={show()} fallback={<Eye size={15} />}>
                  <EyeOff size={15} />
                </Show>
              </button>
            </div>
          </Field>
          <Field label="Confirm new password" for="pw-conf" error={touched() && confirm() !== next() ? "Passwords don't match." : null}>
            <input id="pw-conf" type={show() ? "text" : "password"} autocomplete="new-password" class="input" value={confirm()} onInput={(e) => setConfirm(e.currentTarget.value)} />
          </Field>
        </div>
        <Show when={next()}>
          <div>
            <div class="grid grid-cols-4 gap-1.5">
              <For each={[1, 2, 3, 4]}>
                {(i) => (
                  <span
                    class={cx(
                      "h-1.5 rounded-full transition-colors",
                      score() >= i ? (score() <= 1 ? "bg-crimson-500" : score() === 2 ? "bg-amber-500" : "bg-lime-500") : "bg-sunken",
                    )}
                  />
                )}
              </For>
            </div>
            <p class="mt-1.5 text-xs text-muted">
              Strength: <strong class="text-ink-2">{STRENGTH[score()]}</strong>
            </p>
          </div>
        </Show>
        <div class="flex justify-end pt-4 border-t border-line">
          <button type="submit" class="btn btn-primary" disabled={busy()}>
            {busy() ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>

      <aside class="card p-5 sm:p-6">
        <h2 class="text-[16px] font-semibold">Active sessions</h2>
        <p class="mt-1 text-[12.5px] text-muted">Devices currently signed in to your account.</p>
        <ul class="grid gap-3 mt-4">
          <For
            each={[
              { icon: Laptop, name: "Chrome on Windows", meta: "Lucknow · This device", current: true },
              { icon: Smartphone, name: "Safari on iPhone", meta: "Lucknow · 2 days ago" },
            ]}
          >
            {(d) => (
              <li class="flex items-center gap-3 p-3 rounded-2xl border border-line">
                <span class="grid place-items-center w-10 h-10 rounded-xl bg-sunken text-ink-2">
                  <Dynamic component={d.icon} size={18} />
                </span>
                <span class="flex-1 min-w-0">
                  <span class="block text-[13px] font-semibold">{d.name}</span>
                  <span class="block text-[11.5px] text-muted">{d.meta}</span>
                </span>
                <Show when={d.current}>
                  <span class="badge badge-success">Active</span>
                </Show>
              </li>
            )}
          </For>
        </ul>
        <button class="btn btn-danger w-full mt-4" onClick={() => toast("Other sessions have been signed out.")}>
          Sign out other sessions
        </button>
      </aside>
    </div>
  );
}

function ThemeCard(props) {
  const on = () => theme() === props.value;
  return (
    <button
      type="button"
      onClick={() => setTheme(props.value)}
      class={cx("group text-left p-2.5 rounded-2xl border-[1.5px] transition", on() ? "border-plum-500 dark:border-lime-400 ring-4 ring-plum-100 dark:ring-lime-400/10" : "border-line hover:border-line-strong")}
      aria-pressed={on()}
    >
      <div class={cx("relative h-24 rounded-xl overflow-hidden border border-line", props.preview)}>
        <div class={cx("absolute left-2.5 top-2.5 right-2.5 h-4 rounded-md", props.bar)} />
        <div class={cx("absolute left-2.5 top-9 w-1/2 h-2 rounded", props.line)} />
        <div class={cx("absolute left-2.5 top-[52px] w-1/3 h-2 rounded", props.line)} />
        <div class="absolute right-2.5 bottom-2.5 w-8 h-3 rounded bg-lime-400" />
      </div>
      <div class="flex items-center justify-between mt-2.5 px-1">
        <span class="flex items-center gap-2 text-[13px] font-semibold">
          {props.icon} {props.label}
        </span>
        <span class={cx("grid place-items-center w-5 h-5 rounded-full", on() ? "bg-plum-700 text-white dark:bg-lime-400 dark:text-plum-950" : "border border-line")}>
          <Show when={on()}>
            <Check size={12} stroke-width={3} />
          </Show>
        </span>
      </div>
    </button>
  );
}

function Preferences() {
  const me = user();
  const [prefs, setPrefs] = createSignal({ emailReminders: true, resultEmails: true, weeklyDigest: false, ...me.preferences });
  const set = async (k, v) => {
    setPrefs({ ...prefs(), [k]: v });
    try {
      updateUser(await updateProfile(me.id, { preferences: { [k]: v } }));
      toast("Preference saved.");
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  };

  return (
    <div class="grid gap-6">
      <section class="card p-5 sm:p-7">
        <h2 class="text-[16px] font-semibold">Appearance</h2>
        <p class="mt-1 text-[13px] text-muted">Choose how the portal looks on this device.</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 max-w-[720px]">
          <ThemeCard value="light" label="Light" icon={<Sun size={15} />} preview="bg-[#F5F1E8]" bar="bg-[#542C5F]" line="bg-[#E4DDCF]" />
          <ThemeCard value="dark" label="Dark" icon={<Moon size={15} />} preview="bg-[#120B15]" bar="bg-[#2F1835]" line="bg-[#35273F]" />
          <ThemeCard value="system" label="System" icon={<Monitor size={15} />} preview="bg-gradient-to-r from-[#F5F1E8] from-50% to-[#120B15] to-50%" bar="bg-[#542C5F]" line="bg-[#A877B2]/40" />
        </div>
      </section>

      <section class="card p-5 sm:p-7">
        <h2 class="text-[16px] font-semibold">Notifications</h2>
        <p class="mt-1 text-[13px] text-muted">Emails go to {me.email}.</p>
        <ul class="mt-4 divide-y divide-line">
          <For
            each={[
              ["emailReminders", "Training reminders", "A nudge when a module is assigned or the due date is near."],
              ["resultEmails", "Assessment results", "A copy of your scoreboard after every attempt."],
              ["weeklyDigest", "Weekly digest", "New materials and announcements, every Monday."],
            ]}
          >
            {([k, title, desc]) => (
              <li class="flex items-center justify-between gap-4 py-4">
                <div>
                  <p class="text-[13.5px] font-semibold">{title}</p>
                  <p class="text-[12.5px] text-muted">{desc}</p>
                </div>
                <Toggle checked={prefs()[k]} onChange={(v) => set(k, v)} label={title} />
              </li>
            )}
          </For>
        </ul>
      </section>
    </div>
  );
}
