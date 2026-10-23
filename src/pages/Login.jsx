// Login. Email + password only — the backend decides who you are, your
// department and your designation, and the app routes you from there.
// Mock mode: any account in data/org.js; demo chips fill the form.

import { createSignal, For, Show } from "solid-js";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CircleAlert, CircleCheck, Sparkles, Timer, FileText, BadgeCheck } from "lucide-solid";
import { navigate, query } from "../lib/router";
import { cx } from "../lib/format";
import { signIn } from "../store/auth";
import { requestPasswordReset } from "../services/auth";
import { DEMO_ACCOUNTS, MOCK_EMPLOYEE_PASSWORD, MOCK_ADMIN_PASSWORD } from "../data/org";
import { Logo, ThemeToggle, Avatar, ProgressRing, ProgressBar } from "../components/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Showcase() {
  return (
    <section class="relative hidden lg:flex flex-col overflow-hidden hero-deep grain text-white px-12 xl:px-16 py-10">
      <div class="absolute inset-0 grid-lines pointer-events-none" />
      {/* Soft orbs */}
      <div class="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-lime-400/10 blur-[90px] pointer-events-none" />
      <div class="absolute bottom-[-180px] left-[-120px] w-[460px] h-[460px] rounded-full bg-plum-500/25 blur-[100px] pointer-events-none" />

      <div class="relative z-[1] flex items-center justify-between">
        <Logo onDark wordmark={false} size="h-10" />
      </div>

      <div class="relative z-[1] flex-1 grid grid-cols-[minmax(0,1fr)_auto] gap-10 items-center my-10">
        <div class="max-w-[520px] stagger">
          <p class="eyebrow-lime mb-5">
            <Sparkles size={13} /> ACL Training &amp; Assessment
          </p>
          <h1 class="text-[46px] xl:text-[56px] leading-[1.02] font-semibold tracking-[-0.035em]">
            Learn your craft.
            <br />
            Prove your <span class="text-lime-gradient">mastery.</span>
          </h1>
          <p class="mt-6 text-[16px] leading-relaxed text-white/70 max-w-[440px]">
            Your role-specific training, beautifully organised — read, practise and get certified in one calm, focused space.
          </p>
          <div class="mt-9 grid gap-3.5 max-w-[420px]">
            <For
              each={[
                [FileText, "Guides, manuals & PDFs tailored to your designation"],
                [Timer, "Timed, focus-protected assessments"],
                [BadgeCheck, "Instant scoreboard with a full answer review"],
              ]}
            >
              {([Icon, text]) => (
                <div class="flex items-center gap-3 text-[14px] text-white/80">
                  <span class="grid place-items-center w-8 h-8 rounded-lg glass">
                    <Icon size={15} class="text-lime-300" />
                  </span>
                  {text}
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Floating product preview */}
        <div class="relative hidden xl:block w-[270px] h-[330px]">
          <div class="absolute top-0 right-0 w-[250px] p-5 rounded-3xl glass animate-float" style={{ "animation-delay": "0s" }}>
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Your score</span>
              <span class="badge bg-lime-400 text-plum-950">Passed</span>
            </div>
            <div class="flex items-center gap-4 mt-4">
              <ProgressRing value={92} size={84} stroke={8} trackClass="stroke-white/10">
                <span class="text-[19px] font-semibold tabular">92%</span>
              </ProgressRing>
              <div>
                <p class="text-[13px] font-semibold">Training assessment</p>
                <p class="text-[11.5px] text-white/55">9 of 10 correct</p>
                <p class="text-[11.5px] text-white/55">Pass mark 70%</p>
              </div>
            </div>
          </div>
          <div class="absolute top-[178px] left-0 w-[230px] p-4 rounded-3xl glass animate-float" style={{ "animation-delay": "-2s" }}>
            <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Training module</p>
            <p class="mt-2 text-[13px] font-semibold">Required modules completed</p>
            <ProgressBar value={100} class="mt-3" trackClass="bg-white/10" />
            <p class="flex items-center gap-2 mt-4 text-[12px] text-white/70">
              <CircleCheck size={14} class="text-lime-300" /> Ready for your assessment
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

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
    await requestPasswordReset(email());
    setBusy(false);
    setMode("sent");
  };

  const useDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.role === "admin" ? MOCK_ADMIN_PASSWORD : MOCK_EMPLOYEE_PASSWORD);
    setError(null);
    setTouched(false);
    pwRef?.focus();
  };

  return (
    <div class="min-h-screen grid lg:grid-cols-[minmax(0,1.15fr)_minmax(460px,1fr)]">
      <Showcase />

      <section class="relative flex flex-col min-h-screen">
        {/* Compact brand band on phones/tablets */}
        <div class="lg:hidden relative overflow-hidden hero-deep grain text-white px-6 pt-6 pb-10">
          <div class="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-lime-400/10 blur-[70px]" />
          <div class="relative z-[1] flex items-center justify-between">
            <Logo onDark wordmark={false} size="h-8" />
          </div>
          <h1 class="relative z-[1] mt-8 text-[30px] leading-[1.08] font-semibold tracking-[-0.03em]">
            Learn your craft. Prove your <span class="text-lime-gradient">mastery.</span>
          </h1>
        </div>

        <div class="absolute top-4 right-4 z-10 hidden lg:block">
          <ThemeToggle />
        </div>

        <div class="flex-1 grid place-items-center px-6 sm:px-10 py-10 -mt-6 lg:mt-0">
          <div class="w-full max-w-[420px]">
            <div class="card lg:!bg-transparent lg:!border-0 lg:!shadow-none p-6 sm:p-8 lg:p-0 animate-fade-up">
              <Show when={mode() === "signin"}>
                <p class="kicker mb-3">Welcome back</p>
                <h2 class="text-[28px] leading-tight font-semibold tracking-[-0.025em]">Sign in to your portal</h2>
                <p class="mt-2 text-[14px] text-muted">
                  Use your work email. We'll take you straight to the training set for your role.
                </p>

                <Show when={error()}>
                  <div class="mt-6 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-crimson-50 text-crimson-700 dark:bg-crimson-500/10 dark:text-crimson-300 text-[13px] font-medium animate-fade-in" role="alert">
                    <CircleAlert size={17} class="shrink-0 mt-px" /> {error()}
                  </div>
                </Show>

                <form class="mt-7 grid gap-5" onSubmit={submit} novalidate>
                  <div>
                    <label class="label" for="email">Work email</label>
                    <div class="relative">
                      <Mail size={17} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        autocomplete="username"
                        placeholder="you@aajneeti.com"
                        class={cx("input h-12 pl-11", touched() && !emailOk() && "input-invalid")}
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
                      <label class="label" for="password">Password</label>
                      <button
                        type="button"
                        class="mb-1.5 text-[12.5px] font-semibold text-plum-600 hover:text-plum-800 dark:text-lime-300 dark:hover:text-lime-200"
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
                      <Lock size={17} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      <input
                        ref={pwRef}
                        id="password"
                        type={showPw() ? "text" : "password"}
                        autocomplete="current-password"
                        placeholder="••••••••"
                        class={cx("input h-12 pl-11 pr-12", touched() && !pwOk() && "input-invalid")}
                        value={password()}
                        onInput={(e) => setPassword(e.currentTarget.value)}
                        aria-invalid={touched() && !pwOk()}
                      />
                      <button
                        type="button"
                        class="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-ink hover:bg-sunken"
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

                  <label class="flex items-center gap-2.5 text-[13px] font-medium text-ink-2 cursor-pointer select-none">
                    <input type="checkbox" checked={remember()} onChange={(e) => setRemember(e.currentTarget.checked)} class="w-4 h-4 rounded accent-plum-700 dark:accent-lime-400" />
                    Keep me signed in on this device
                  </label>

                  <button type="submit" class="btn btn-primary btn-lg w-full mt-1" disabled={busy()}>
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

                {/* Mock mode only — remove with the real backend. */}
                <div class="mt-9">
                  <div class="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    <span class="h-px flex-1 bg-line" /> Demo accounts <span class="h-px flex-1 bg-line" />
                  </div>
                  <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <For each={DEMO_ACCOUNTS}>
                      {(acc) => (
                        <button
                          type="button"
                          onClick={() => useDemo(acc)}
                          class={cx(
                            "group flex items-center gap-3 p-2.5 rounded-xl border text-left transition",
                            email() === acc.email
                              ? "border-plum-400 bg-plum-50/70 dark:border-lime-400/50 dark:bg-lime-400/10"
                              : "border-line bg-surface hover:border-line-strong hover:-translate-y-px hover:shadow-card",
                          )}
                        >
                          <Avatar name={acc.label} size={32} />
                          <span class="min-w-0">
                            <span class="block text-[12.5px] font-semibold truncate">{acc.label}</span>
                            <span class="block text-[11px] text-muted truncate">{acc.hint}</span>
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                  <p class="mt-3 text-[11.5px] text-muted text-center">
                    Mock mode · employees <code class="font-semibold text-ink-2">{MOCK_EMPLOYEE_PASSWORD}</code> · admins{" "}
                    <code class="font-semibold text-ink-2">{MOCK_ADMIN_PASSWORD}</code>
                  </p>
                </div>
              </Show>

              <Show when={mode() === "forgot"}>
                <button class="inline-flex items-center gap-1.5 mb-6 text-[13px] font-semibold text-muted hover:text-ink" onClick={() => setMode("signin")}>
                  <ArrowLeft size={15} /> Back to sign in
                </button>
                <p class="kicker mb-3">Account recovery</p>
                <h2 class="text-[28px] leading-tight font-semibold tracking-[-0.025em]">Reset your password</h2>
                <p class="mt-2 text-[14px] text-muted">Enter your work email and we'll send you a secure link to choose a new password.</p>
                <form class="mt-7 grid gap-5" onSubmit={forgot} novalidate>
                  <div>
                    <label class="label" for="femail">Work email</label>
                    <div class="relative">
                      <Mail size={17} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      <input
                        id="femail"
                        type="email"
                        class={cx("input h-12 pl-11", touched() && !emailOk() && "input-invalid")}
                        placeholder="you@aajneeti.com"
                        value={email()}
                        onInput={(e) => setEmail(e.currentTarget.value)}
                      />
                    </div>
                    <Show when={touched() && !emailOk()}>
                      <p class="error-text">Enter a valid email address.</p>
                    </Show>
                  </div>
                  <button type="submit" class="btn btn-primary btn-lg w-full" disabled={busy()}>
                    {busy() ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              </Show>

              <Show when={mode() === "sent"}>
                <div class="grid justify-items-center text-center gap-3 py-4">
                  <span class="grid place-items-center w-16 h-16 rounded-2xl bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300 animate-pop">
                    <Mail size={26} />
                  </span>
                  <h2 class="text-[24px] font-semibold tracking-[-0.02em]">Check your inbox</h2>
                  <p class="text-[14px] text-muted max-w-[320px]">
                    If <strong class="text-ink">{email()}</strong> has an account, a reset link is on its way. It expires in 30 minutes.
                  </p>
                  <button class="btn btn-secondary mt-3" onClick={() => setMode("signin")}>
                    <ArrowLeft size={15} /> Back to sign in
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </div>

        <p class="pb-6 text-center text-[11.5px] text-muted">
          © {new Date().getFullYear()} Aajneeti · Trouble signing in? Contact your training admin.
        </p>
      </section>
    </div>
  );
}
