// Login. Email + password only — the backend decides who you are, your
// department and your designation, and the app routes you from there.
// Mock mode: any account in data/org.js; demo chips fill the form.

import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CircleAlert, BookOpen, Timer, BadgeCheck, TrendingUp } from "lucide-solid";
import { navigate, query } from "../lib/router";
import { cx } from "../lib/format";
import { signIn } from "../store/auth";
import { toast } from "../store/toast";
import { requestPasswordReset } from "../services/auth";
import { DEMO_MODE, DEMO_ACCOUNTS, demoPassword } from "../services/demo";
import { Logo, Avatar } from "../components/ui";
import { mountFlowWaves } from "../lib/flowWaves";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEATURES = [
  { icon: BookOpen, title: "Role-based guides", text: "Manuals and PDFs picked for your designation" },
  { icon: Timer, title: "Timed tests", text: "One focused test, with a warning if you leave the page" },
  { icon: BadgeCheck, title: "Instant results", text: "Your score and a full answer review after you submit" },
  { icon: TrendingUp, title: "Tracked progress", text: "Your admin sees where you are and what's next" },
];

// Left panel copy: badge, headline, line and the 2×2 feature tiles.
function Intro() {
  return (
    <div class="max-w-[560px]">
      <span class="auth-badge flow-rise-soft inline-flex items-center gap-2 h-8 px-3.5 rounded-full text-[13px] font-medium" style={{ "--d": "0.2s" }}>
        <span class="flow-pulse w-1.5 h-1.5 rounded-full bg-[#F05A6E]" />
        Training &amp; assessment portal
      </span>
      <h1 class="auth-headline mt-5 text-[34px] sm:text-[46px] xl:text-[52px] leading-[1.06] font-semibold tracking-[-0.03em]">
        <span class="flow-rise block" style={{ "--d": "0.3s" }}>
          <em class="font-medium">Training</em> that flows
        </span>
        <span class="flow-rise block" style={{ "--d": "0.45s" }}>
          with <span class="auth-headline-accent">your role.</span>
        </span>
      </h1>
      <p class="auth-lede flow-rise-soft mt-4 max-w-[460px] text-[15.5px] sm:text-[16.5px] leading-relaxed" style={{ "--d": "0.6s" }}>
        Read the material picked for your designation, take your timed test and see your result straight away.
      </p>
      <div class="hidden sm:grid grid-cols-2 gap-3 mt-8">
        <For each={FEATURES}>
          {(f, i) => (
            <div class="auth-tile flow-rise-soft" style={{ "--d": `${0.75 + i() * 0.08}s` }}>
              <span class="auth-tile-icon">
                <f.icon size={16} />
              </span>
              <span class="min-w-0">
                <span class="block text-[14px] font-semibold leading-tight">{f.title}</span>
                <span class="auth-tile-text block mt-1 text-[12.5px] leading-snug">{f.text}</span>
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// The moving backdrop of the brand panel: the silk waves rolling (WebGL,
// lib/flowWaves.js), recoloured to the brand's navy and crimson, over the
// static image as a fallback, with a slow camera drift.
function FlowScene() {
  let waves;
  onMount(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    onCleanup(mountFlowWaves(waves, { src: "/login-bg.jpg", animate: !still, tone: "brand" }));
  });

  return (
    <div class="flow-scene" aria-hidden="true">
      <div class="flow-reveal">
        <div class="flow-parallax">
          <div class="flow-drift">
            <div class="flow-image" />
            <div ref={waves} class="flow-waves" />
          </div>
        </div>
      </div>
      <div class="flow-veil" />
    </div>
  );
}

// The sign-in frame: a brand panel on the left (moving waves, logo, intro)
// and the frosted form card on a light panel on the right. Shared with the
// "choose a new password" screen after an admin reset.
export function AuthLayout(props) {
  // Mouse position as --px/--py (-1…1): drives the background parallax and
  // the light on the glass card.
  let root;
  let frame = 0;
  const onPointerMove = (e) => {
    if (e.pointerType !== "mouse" || frame) return;
    const { clientX, clientY } = e;
    frame = requestAnimationFrame(() => {
      frame = 0;
      root.style.setProperty("--px", ((clientX / window.innerWidth) * 2 - 1).toFixed(3));
      root.style.setProperty("--py", ((clientY / window.innerHeight) * 2 - 1).toFixed(3));
    });
  };
  onCleanup(() => cancelAnimationFrame(frame));

  return (
    <div ref={root} class="auth-root min-h-[100dvh] grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]" onPointerMove={onPointerMove}>
      <section class="auth-hero relative overflow-hidden flex flex-col">
        <FlowScene />
        <div class="relative z-10 flex flex-col flex-1 px-6 sm:px-12 xl:px-16 pt-6 sm:pt-10 pb-8 sm:pb-10">
          <div class="flow-rise-soft" style={{ "--d": "0.1s" }}>
            <Logo onDark wordmark={false} size="h-12 sm:h-16" />
          </div>
          <div class="my-auto pt-8 lg:pt-10">
            <Intro />
          </div>
          <p class="auth-hero-foot hidden lg:block flow-rise-soft mt-10 text-[13px]" style={{ "--d": "1.1s" }}>
            © {new Date().getFullYear()} Aajneeti Connect Ltd. All rights reserved.
          </p>
        </div>
      </section>

      <main class="auth-side relative overflow-hidden flex flex-col items-center justify-center px-4 sm:px-8 py-10">
        {/* Soft shapes behind the card: the glass frosts whatever sits under it. */}
        <div class="auth-side-glow auth-side-glow-a" aria-hidden="true" />
        <div class="auth-side-glow auth-side-glow-b" aria-hidden="true" />
        <div class="relative w-full max-w-[460px]">
          <div class="auth-glass flow-card-in p-6 sm:p-9">{props.children}</div>
          <div class="auth-below">{props.below}</div>
          <p class="auth-side-foot flow-rise-soft mt-6 text-center text-[13px]" style={{ "--d": "1s" }}>
            Trouble signing in? Contact your training admin.
            <span class="lg:hidden block mt-1">© {new Date().getFullYear()} Aajneeti Connect Ltd.</span>
          </p>
        </div>
      </main>
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

                  <button type="submit" class="btn btn-primary btn-lg w-full !h-[52px] !rounded-full mt-1 shadow-[0_12px_24px_-12px_rgba(172, 35, 52,0.7)]" disabled={busy()}>
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
                  <button type="submit" class="btn btn-primary btn-lg w-full !h-[52px] !rounded-full shadow-[0_12px_24px_-12px_rgba(172, 35, 52,0.7)]" disabled={busy()}>
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
