// Login. Email + password only — the backend decides who you are, your
// department and your designation, and the app routes you from there.
// Mock mode: any account in data/org.js; demo chips fill the form.

import { createSignal, For, Show } from "solid-js";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CircleAlert, CircleCheck } from "lucide-solid";
import { navigate, query } from "../lib/router";
import { cx } from "../lib/format";
import { signIn } from "../store/auth";
import { toast } from "../store/toast";
import { requestPasswordReset } from "../services/auth";
import { DEMO_MODE, DEMO_ACCOUNTS, demoPassword } from "../services/demo";
import { Logo, ThemeToggle, Avatar } from "../components/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Intro() {
  return (
    <div class="max-w-[520px]">
      <p class="text-[14px] font-semibold text-plum-700 dark:text-lime-400">Aajneeti Connect Ltd</p>
      <h1 class="mt-3 text-[32px] sm:text-[44px] leading-[1.15] font-bold tracking-[-0.02em]">
        Training and assessment, <span class="text-plum-700 dark:text-lime-400">built for your role</span>
      </h1>
      <p class="mt-4 text-[16px] sm:text-[17px] leading-relaxed text-ink-2">
        Sign in to read the material assigned to your designation, take your timed test and see your result straight away.
      </p>
      <ul class="hidden sm:grid mt-7 gap-3.5">
        <For
          each={[
            "Guides, manuals and PDFs picked for your designation",
            "Timed tests with a warning if you leave the page",
            "Your score and a full answer review after you submit",
          ]}
        >
          {(text) => (
            <li class="flex items-start gap-3 text-[15.5px] text-ink">
              <CircleCheck size={20} class="shrink-0 mt-0.5 text-plum-700 dark:text-lime-400" />
              {text}
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

// The sign-in frame — header, intro, frosted card, footer. Shared with the
// "choose a new password" screen after an admin reset.
export function AuthLayout(props) {
  return (
    <div class="min-h-screen flex flex-col bg-canvas">
      <header class="border-b border-line bg-surface">
        <div class="max-w-[1240px] mx-auto h-[64px] sm:h-[74px] px-4 sm:px-6 flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main class="flex-1 hero-wash">
        <div class="hero-ellipses" aria-hidden="true"><span /><span /><span /></div>
        <div class="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-16 grid lg:grid-cols-[minmax(0,1fr)_480px] gap-8 lg:gap-16 items-center">
          <Intro />
          <div class="w-full">
            <div class="relative">
              {/* Shapes behind the card: the glass frosts whatever sits under it. */}
              <div class="absolute -top-12 -right-4 sm:-right-10 w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-gradient-to-br from-plum-500 to-plum-800 pointer-events-none" />
              <div class="absolute -bottom-10 -left-4 sm:-left-12 w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr from-lime-400 to-lime-200 pointer-events-none" />
              <div class="absolute top-1/2 -left-3 sm:-left-8 w-16 h-16 rounded-full bg-gradient-to-br from-plum-300 to-plum-600 opacity-80 pointer-events-none" />
              <div class="relative glass-card p-6 sm:p-10 animate-fade-up">{props.children}</div>
            </div>
            {props.below}
          </div>
        </div>
      </main>

      <footer class="border-t border-line bg-surface">
        <div class="max-w-[1240px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row gap-1 items-center justify-between text-[13px] text-muted">
          <span>© {new Date().getFullYear()} Aajneeti Connect Ltd. All rights reserved.</span>
          <span>Trouble signing in? Contact your training admin.</span>
        </div>
      </footer>
    </div>
  );
}

export const Req = () => <span class="text-crimson-600 dark:text-crimson-300"> *</span>;

export default function Login() {
  const [mode, setMode] = createSignal("signin"); // signin | forgot | sent
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [showPw, setShowPw] = createSignal(false);
  const [remember, setRemember] = createSignal(true);
  const [touched, setTouched] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);
  let pwRef;

  const emailOk = () => EMAIL_RE.test(email().trim());
  const pwOk = () => password().length > 0;

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!emailOk() || !pwOk()) return;
    setBusy(true);
    try {
      const me = await signIn(email(), password(), remember());
      const next = query().get("next");
      const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      navigate(safe && (me.role === "admin") === safe.startsWith("/admin") ? safe : me.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const forgot = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!emailOk()) return;
    setBusy(true);
    try {
      await requestPasswordReset(email());
    } catch (err) {
      setBusy(false);
      toast(err.message, { tone: "error" });
      return;
    }
    setBusy(false);
    setMode("sent");
  };

  const useDemo = (acc) => {
    setEmail(acc.email);
    setPassword(demoPassword(acc));
    setError(null);
    setTouched(false);
    pwRef?.focus();
  };

  return (
    <AuthLayout
      below={
        <>
          {/* Mock mode only — never shown against the real API. */}
          <Show when={DEMO_MODE && mode() === "signin"}>
            <div class="mt-10 sm:mt-12 px-1">
              <p class="text-center text-[13px] font-medium text-ink-2">Demo accounts · tap one to fill the form</p>
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <For each={DEMO_ACCOUNTS}>
                  {(acc) => (
                    <button
                      type="button"
                      onClick={() => useDemo(acc)}
                      class={cx(
                        "flex items-center gap-3 p-3 rounded-2xl border text-left transition",
                        email() === acc.email
                          ? "border-plum-400 bg-plum-50 dark:border-lime-400/50 dark:bg-lime-400/10"
                          : "border-line bg-surface hover:border-plum-200 hover:bg-plum-50/50 dark:hover:bg-white/[0.04]",
                      )}
                    >
                      <Avatar name={acc.label} size={34} />
                      <span class="min-w-0">
                        <span class="block text-[14px] font-semibold truncate">{acc.label}</span>
                        <span class="block text-[12.5px] text-muted truncate">{acc.hint}</span>
                        <code class="block mt-0.5 text-[12px] font-semibold text-ink-2">
                          {demoPassword(acc)}
                        </code>
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </>
      }
    >
              <Show when={mode() === "signin"}>
                <h2 class="text-[28px] leading-tight font-bold tracking-[-0.01em]">Sign in</h2>
                <p class="mt-1.5 text-[15px] text-ink-2">
                  Use your work email. We'll take you straight to the training set for your role.
                </p>

                <Show when={error()}>
                  <div class="mt-6 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-crimson-50 text-crimson-700 dark:bg-crimson-500/10 dark:text-crimson-300 text-[14px] font-medium animate-fade-in" role="alert">
                    <CircleAlert size={17} class="shrink-0 mt-px" /> {error()}
                  </div>
                </Show>

                <form class="mt-8 grid gap-7" onSubmit={submit} novalidate>
                  <div>
                    <label class="label !mb-0 text-[13px] !font-medium !text-ink-2" for="email">Work email<Req /></label>
                    <div class="relative">
                      <Mail size={17} class="absolute left-0 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        autocomplete="username"
                        placeholder="you@aajneeti.social"
                        class={cx("input-line pl-8", touched() && !emailOk() && "input-invalid")}
                        value={email()}
                        onInput={(e) => setEmail(e.currentTarget.value)}
                        aria-invalid={touched() && !emailOk()}
                      />
                    </div>
                    <Show when={touched() && !emailOk()}>
                      <p class="error-text">Enter a valid email address.</p>
                    </Show>
                  </div>

                  <div>
                    <div class="flex items-center justify-between">
                      <label class="label !mb-0 text-[13px] !font-medium !text-ink-2" for="password">Password<Req /></label>
                      <button
                        type="button"
                        class="text-[13px] font-medium text-plum-700 hover:underline dark:text-lime-400"
                        onClick={() => {
                          setMode("forgot");
                          setTouched(false);
                          setError(null);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div class="relative">
                      <Lock size={17} class="absolute left-0 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      <input
                        ref={pwRef}
                        id="password"
                        type={showPw() ? "text" : "password"}
                        autocomplete="current-password"
                        placeholder="••••••••"
                        class={cx("input-line pl-8 pr-10", touched() && !pwOk() && "input-invalid")}
                        value={password()}
                        onInput={(e) => setPassword(e.currentTarget.value)}
                        aria-invalid={touched() && !pwOk()}
                      />
                      <button
                        type="button"
                        class="absolute right-0 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-ink"
                        onClick={() => setShowPw(!showPw())}
                        aria-label={showPw() ? "Hide password" : "Show password"}
                      >
                        <Show when={showPw()} fallback={<Eye size={17} />}>
                          <EyeOff size={17} />
                        </Show>
                      </button>
                    </div>
                    <Show when={touched() && !pwOk()}>
                      <p class="error-text">Enter your password.</p>
                    </Show>
                  </div>

                  <label class="flex items-center gap-2.5 text-[14px] font-medium text-ink-2 cursor-pointer select-none">
                    <input type="checkbox" checked={remember()} onChange={(e) => setRemember(e.currentTarget.checked)} class="w-4 h-4 rounded accent-plum-700 dark:accent-lime-400" />
                    Keep me signed in on this device
                  </label>

                  <button type="submit" class="btn btn-primary btn-lg w-full !h-[52px] !rounded-full mt-1 shadow-[0_12px_24px_-12px_rgba(52,99,175,0.7)]" disabled={busy()}>
                    <Show
                      when={busy()}
                      fallback={
                        <>
                          Sign in <ArrowRight size={17} />
                        </>
                      }
                    >
                      <span class="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> Signing you in…
                    </Show>
                  </button>
                </form>
              </Show>

              <Show when={mode() === "forgot"}>
                <button class="inline-flex items-center gap-1.5 mb-6 text-[14px] font-semibold text-muted hover:text-ink" onClick={() => setMode("signin")}>
                  <ArrowLeft size={15} /> Back to sign in
                </button>
                <h2 class="text-[24px] leading-tight font-bold">Reset your password</h2>
                <p class="mt-1.5 text-[15px] text-ink-2">Enter your work email. Your training admin will reset your password and share a temporary one with you.</p>
                <form class="mt-7 grid gap-5" onSubmit={forgot} novalidate>
                  <div>
                    <label class="label !mb-0 text-[13px] !font-medium !text-ink-2" for="femail">Work email<Req /></label>
                    <div class="relative">
                      <Mail size={17} class="absolute left-0 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      <input
                        id="femail"
                        type="email"
                        class={cx("input-line pl-8", touched() && !emailOk() && "input-invalid")}
                        placeholder="you@aajneeti.social"
                        value={email()}
                        onInput={(e) => setEmail(e.currentTarget.value)}
                      />
                    </div>
                    <Show when={touched() && !emailOk()}>
                      <p class="error-text">Enter a valid email address.</p>
                    </Show>
                  </div>
                  <button type="submit" class="btn btn-primary btn-lg w-full !h-[52px] !rounded-full shadow-[0_12px_24px_-12px_rgba(52,99,175,0.7)]" disabled={busy()}>
                    {busy() ? "Sending…" : "Request a reset"}
                  </button>
                </form>
              </Show>

              <Show when={mode() === "sent"}>
                <div class="grid justify-items-center text-center gap-3 py-4">
                  <span class="grid place-items-center w-16 h-16 rounded-2xl bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-400 animate-pop">
                    <Mail size={26} />
                  </span>
                  <h2 class="text-[24px] font-bold">Request sent</h2>
                  <p class="text-[15px] text-muted max-w-[320px]">
                    If <strong class="text-ink">{email()}</strong> has an account, your training admin has been notified. They'll share a temporary password
                    with you, and you'll choose a new one when you sign in.
                  </p>
                  <button class="btn btn-secondary mt-3" onClick={() => setMode("signin")}>
                    <ArrowLeft size={15} /> Back to sign in
                  </button>
                </div>
              </Show>
    </AuthLayout>
  );
}
