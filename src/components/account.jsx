// Account: the Profile settings page pieces — details and change password.
// (The password screen after an admin reset is pages/NewPassword.jsx.)
//
// Employees edit phone, location, bio and preferences. Name, email,
// employee code, designation and department are read-only: admins own them.

import { createSignal, For, Show } from "solid-js";
import { Eye, EyeOff, KeyRound } from "lucide-solid";
import { cx } from "../lib/format";
import { user, updateUser } from "../store/auth";
import { updateProfile, changePassword, listOfficeLocations } from "../services/auth";
import { toast } from "../store/toast";
import { Field, Toggle } from "./ui";
import LocationSelect from "./LocationSelect";
import { phoneProblem } from "../lib/phone";

const PW_MIN = 8;
const pwProblem = (p) => (p.length < PW_MIN ? `Use at least ${PW_MIN} characters.` : !/[A-Za-z]/.test(p) || !/[0-9]/.test(p) ? "Use at least one letter and one number." : null);

function PasswordInput(props) {
  const [show, setShow] = createSignal(false);
  return (
    <div class="relative">
      <input
        id={props.id}
        type={show() ? "text" : "password"}
        autocomplete={props.autocomplete}
        class={cx("input pr-11", props.invalid && "input-invalid")}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
      <button
        type="button"
        class="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-ink"
        onClick={() => setShow(!show())}
        aria-label={show() ? "Hide password" : "Show password"}
      >
        <Show when={show()} fallback={<Eye size={17} />}>
          <EyeOff size={17} />
        </Show>
      </button>
    </div>
  );
}

// Current → new → confirm. onDone(me) after a successful change.
export function PasswordForm(props) {
  const [current, setCurrent] = createSignal("");
  const [next, setNext] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  const [touched, setTouched] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);

  const errors = () => ({
    current: current() ? null : "Enter your current password.",
    next: pwProblem(next()) ?? (next() === current() ? "Choose a password different from your current one." : null),
    confirm: confirm() === next() ? null : "The new passwords don't match.",
  });

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (Object.values(errors()).some(Boolean)) return;
    setBusy(true);
    try {
      const me = await changePassword(user().id, current(), next(), confirm());
      toast("Your password has been changed. Other devices have been signed out.", { title: "Password updated" });
      setCurrent("");
      setNext("");
      setConfirm("");
      setTouched(false);
      await props.onDone?.(me);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="grid gap-4" onSubmit={submit} novalidate>
      <Show when={error()}>
        <p class="error-text !mt-0" role="alert">{error()}</p>
      </Show>
      <Field label={props.currentLabel ?? "Current password"} for="pw-current" error={touched() && errors().current}>
        <PasswordInput id="pw-current" autocomplete="current-password" value={current()} onInput={setCurrent} invalid={touched() && errors().current} />
      </Field>
      <Field label="New password" for="pw-new" error={touched() && errors().next} hint="At least 8 characters, with a letter and a number.">
        <PasswordInput id="pw-new" autocomplete="new-password" value={next()} onInput={setNext} invalid={touched() && errors().next} />
      </Field>
      <Field label="Confirm new password" for="pw-confirm" error={touched() && errors().confirm}>
        <PasswordInput id="pw-confirm" autocomplete="new-password" value={confirm()} onInput={setConfirm} invalid={touched() && errors().confirm} />
      </Field>
      <button type="submit" class="btn btn-primary w-full" disabled={busy()}>
        <KeyRound size={15} /> {busy() ? "Saving…" : props.submitLabel ?? "Change password"}
      </button>
    </form>
  );
}

const PREFS = [
  ["emailReminders", "Training reminders"],
  ["resultEmails", "Result notifications"],
  ["weeklyDigest", "Weekly digest"],
];

function ReadOnly(props) {
  return (
    <div>
      <p class="label">{props.label}</p>
      <p class="input flex items-center bg-sunken/60 text-ink-2 cursor-default select-text" aria-readonly="true">
        <span class="truncate">{props.value || "—"}</span>
      </p>
    </div>
  );
}

// Read-only organisation details + the fields an employee may edit.
export function ProfileDetails() {
  const me = () => user();
  const [f, setF] = createSignal({ phone: me().phone ?? "", location: me().location ?? "", bio: me().bio ?? "", preferences: { ...me().preferences } });
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);
  const set = (k) => (v) => setF({ ...f(), [k]: v });

  const [touched, setTouched] = createSignal(false);
  const phoneError = () => touched() && phoneProblem(f().phone);

  const save = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (phoneProblem(f().phone)) return;
    setBusy(true);
    setError(null);
    try {
      updateUser(await updateProfile(me().id, { ...f(), phone: f().phone.trim() }));
      toast("Your profile has been saved.", { title: "Profile updated" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="grid gap-5" onSubmit={save} novalidate>
      <Show when={error()}>
        <p class="error-text !mt-0" role="alert">{error()}</p>
      </Show>
      <div class="grid sm:grid-cols-2 gap-4">
        <ReadOnly label="Name" value={me().name} />
        <ReadOnly label="Email" value={me().email} />
        <ReadOnly label="Employee code" value={me().code} />
        <ReadOnly label={me().role === "admin" ? "Role" : "Designation"} value={me().role === "admin" ? me().adminTitle : me().designation?.title} />
        <Show when={me().role !== "admin"}>
          <ReadOnly label="Department" value={me().department?.name} />
          <ReadOnly label="Joined" value={me().joinedAt ? new Date(me().joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""} />
        </Show>
      </div>
      <p class="-mt-2 text-[13px] text-muted">These details are managed by your training admin.</p>
      <div class="h-px bg-line" />
      <div class="grid sm:grid-cols-2 gap-4">
        <Field label="Mobile number" for="acc-phone" error={phoneError()}>
          <input
            id="acc-phone"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            class={cx("input", phoneError() && "input-invalid")}
            maxLength={30}
            placeholder="+91 98765 43210"
            value={f().phone}
            onInput={(e) => set("phone")(e.currentTarget.value)}
          />
        </Field>
        <Field label="Location" for="acc-location">
          <LocationSelect id="acc-location" load={listOfficeLocations} value={f().location} onChange={set("location")} />
        </Field>
      </div>
      <Field label="Bio" for="acc-bio" optional>
        <textarea id="acc-bio" class="input min-h-[96px] py-2.5" maxLength={1000} value={f().bio} onInput={(e) => set("bio")(e.currentTarget.value)} />
      </Field>
      <div class="grid gap-2.5">
        <p class="label !mb-0">Notifications</p>
        <For each={PREFS}>
          {([k, label]) => (
            <div class="flex items-center justify-between gap-3 text-[14px]">
              <span>{label}</span>
              <Toggle checked={!!f().preferences[k]} label={label} onChange={(v) => setF({ ...f(), preferences: { ...f().preferences, [k]: v } })} />
            </div>
          )}
        </For>
      </div>
      <div class="flex justify-end">
        <button type="submit" class="btn btn-primary w-full sm:w-auto" disabled={busy()}>
          {busy() ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
