// "Choose a new password" — shown after an admin reset, whatever URL is
// open, until the temporary password is replaced. Same frame and form
// style as the login page.

import { createSignal, Show } from "solid-js";
import { Lock, KeyRound, Eye, EyeOff, ArrowRight, ArrowLeft, CircleAlert } from "lucide-solid";
import { cx } from "../lib/format";
import { navigate } from "../lib/router";
import { user, passwordChanged, signOut } from "../store/auth";
import { changePassword } from "../services/auth";
import { toast } from "../store/toast";
import { AuthLayout, Req } from "./Login";

const PW_MIN = 8;
const pwProblem = (p) => (p.length < PW_MIN ? `Use at least ${PW_MIN} characters.` : !/[A-Za-z]/.test(p) || !/[0-9]/.test(p) ? "Use at least one letter and one number." : null);

// A login-style underlined password field with an icon and show/hide.
function LinePassword(props) {
  const [show, setShow] = createSignal(false);
  return (
    <div>
      <label class="label !mb-0 text-[13px] !font-medium !text-ink-2" for={props.id}>
        {props.label}
        <Req />
      </label>
      <div class="relative">
        <FieldIcon icon={props.icon ?? Lock} />
        <input
          id={props.id}
          type={show() ? "text" : "password"}
          autocomplete={props.autocomplete}
          placeholder="••••••••"
          class={cx("input-line pl-8 pr-10", props.error && "input-invalid")}
          value={props.value}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          aria-invalid={!!props.error}
        />
        <button
          type="button"
          class="absolute right-0 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-ink"
          onClick={() => setShow(!show())}
          aria-label={show() ? "Hide password" : "Show password"}
        >
          <Show when={show()} fallback={<Eye size={17} />}>
            <EyeOff size={17} />
          </Show>
        </button>
      </div>
      <Show when={props.error} fallback={<Show when={props.hint}><p class="hint">{props.hint}</p></Show>}>
        <p class="error-text">{props.error}</p>
      </Show>
    </div>
  );
}

// Icon positioned like the login form's field icons.
function FieldIcon(props) {
  const Icon = props.icon;
  return <Icon size={17} class="absolute left-0 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />;
}

export default function NewPassword() {
  const [current, setCurrent] = createSignal("");
  const [next, setNext] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  const [touched, setTouched] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);

  const errors = () => ({
    current: current() ? null : "Enter the temporary password from your admin.",
    next: pwProblem(next()) ?? (next() === current() ? "Choose a password different from the temporary one." : null),
    confirm: confirm() && confirm() === next() ? null : "The new passwords don't match.",
  });
  const show = (k) => touched() && errors()[k];

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (Object.values(errors()).some(Boolean)) return;
    setBusy(true);
    try {
      const me = await changePassword(user().id, current(), next(), confirm());
      toast("Your new password is set.", { title: "Welcome" });
      await passwordChanged(me);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const out = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <AuthLayout>
      <h2 class="text-[28px] leading-tight font-bold tracking-[-0.01em]">Create a new password</h2>
      <p class="mt-1.5 text-[15px] text-ink-2">
        Hi {user()?.name?.split(" ")[0]}, you signed in with a temporary password from your admin. Choose your own password to continue.
      </p>

      <Show when={error()}>
        <div class="mt-6 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-crimson-50 text-crimson-700 dark:bg-crimson-500/10 dark:text-crimson-300 text-[14px] font-medium animate-fade-in" role="alert">
          <CircleAlert size={17} class="shrink-0 mt-px" /> {error()}
        </div>
      </Show>

      <form class="mt-8 grid gap-7" onSubmit={submit} novalidate>
        <LinePassword id="np-current" label="Temporary password" autocomplete="current-password" value={current()} onInput={setCurrent} error={show("current")} />
        <LinePassword
          id="np-new"
          label="New password"
          icon={KeyRound}
          autocomplete="new-password"
          value={next()}
          onInput={setNext}
          error={show("next")}
          hint="At least 8 characters, with a letter and a number."
        />
        <LinePassword id="np-confirm" label="Confirm new password" icon={KeyRound} autocomplete="new-password" value={confirm()} onInput={setConfirm} error={show("confirm")} />

        <button type="submit" class="btn btn-primary btn-lg w-full !h-[52px] !rounded-full mt-1 shadow-[0_12px_24px_-12px_rgba(52,99,175,0.7)]" disabled={busy()}>
          <Show
            when={busy()}
            fallback={
              <>
                Save and continue <ArrowRight size={17} />
              </>
            }
          >
            <span class="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> Saving…
          </Show>
        </button>
      </form>

      <button class="mt-5 mx-auto flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink" onClick={out}>
        <ArrowLeft size={15} /> Back to sign in
      </button>
    </AuthLayout>
  );
}
