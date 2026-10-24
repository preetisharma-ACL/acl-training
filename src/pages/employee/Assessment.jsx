// ─── Assessment ─────────────────────────────────────────────────────────────
// Ported from the original Training page; behaviour is unchanged:
//   • timed multiple-choice quiz, four options per question
//   • leaving the tab/window pauses the test with a warning and counts it
//   • answers + time left persist (store/assessment.js); a reload resumes
//     paused and counts a "left" warning
//   • auto-submits at 00:00; manual submit asks for confirmation
//   • keyboard: A–D / 1–4 to answer, ← → to move
// While it runs, App.jsx renders nothing else — the training module and the
// rest of the portal are unreachable until the attempt is submitted.

import { batch, createSignal, createMemo, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import { GraduationCap, ChevronLeft, ChevronRight, TriangleAlert, Play, Send, Timer, Flag, Lock } from "lucide-solid";
import { navigate } from "../../lib/router";
import { cx, fmtClock } from "../../lib/format";
import { session as s, setSession as setS, endSession } from "../../store/assessment";
import { submitAttempt } from "../../services/training";
import { Modal } from "../../components/ui";

const LETTERS = ["A", "B", "C", "D"];

const PAUSE_COPY = {
  hidden: "You switched tabs or minimised the browser.",
  blur: "The test window lost focus.",
  left: "You left the test before finishing it.",
};

export default function Assessment() {
  const [confirmSubmit, setConfirmSubmit] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal(null);
  const [flags, setFlags] = createSignal({}); // review-later marks, this screen only

  const questions = () => s.attempt?.questions ?? [];
  const q = () => questions()[s.current];
  const answeredCount = () => questions().filter((x) => s.answers[x.id] !== undefined).length;
  const unanswered = () => questions().length - answeredCount();
  // Memo, so the clock effect re-runs only when running flips — not every tick.
  const running = createMemo(() => !s.paused && !submitting() && s.remaining > 0);
  const lowTime = () => s.remaining <= 60;
  const timePct = () => (s.attempt ? (s.remaining / s.attempt.durationSeconds) * 100 : 0);

  const pause = (reason) => {
    if (s.paused || submitting()) return;
    setConfirmSubmit(false);
    setS({ paused: true, pauseReason: reason, violations: s.violations + 1 });
  };

  const submit = async (auto = false) => {
    if (submitting()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitAttempt({
        ...s.attempt,
        answers: { ...s.answers },
        timeTakenSeconds: s.attempt.durationSeconds - s.remaining,
        focusViolations: s.violations,
        autoSubmitted: auto,
      });
      // Together, so the route guard sees "no test running" and the new URL at once.
      batch(() => {
        endSession();
        navigate(`/scoreboard/${result.id}?fresh=1`, { replace: true });
      });
    } catch (err) {
      setSubmitError(err?.message || "Couldn't submit. Your answers are saved — please try again.");
      setSubmitting(false);
    }
  };

  // The clock. One interval, alive only while the test is actually running.
  createEffect(() => {
    if (!running()) return;
    const t = setInterval(() => {
      const next = s.remaining - 1;
      setS("remaining", Math.max(0, next));
      if (next <= 0) {
        clearInterval(t);
        setConfirmSubmit(false);
        submit(true);
      }
    }, 1000);
    onCleanup(() => clearInterval(t));
  });

  // Focus guard: any way of leaving the window pauses the test.
  onMount(() => {
    const onVisibility = () => document.hidden && pause("hidden");
    const onBlur = () => pause("blur");
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onKey = (e) => {
      if (s.paused || submitting() || confirmSubmit()) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toUpperCase();
      const idx = ["1", "2", "3", "4"].indexOf(k) >= 0 ? Number(k) - 1 : LETTERS.indexOf(k);
      if (idx >= 0 && q()?.options[idx]) {
        e.preventDefault();
        choose(q().options[idx].id);
      } else if (e.key === "ArrowRight") go(s.current + 1);
      else if (e.key === "ArrowLeft") go(s.current - 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    });
  });

  const choose = (optionId) => setS("answers", q().id, optionId);
  const go = (i) => {
    if (i >= 0 && i < questions().length) setS("current", i);
  };
  const toggleFlag = () => setFlags({ ...flags(), [q().id]: !flags()[q().id] });
  const isLast = () => s.current === questions().length - 1;
  const behind = () => (s.paused ? "blur-md pointer-events-none" : "");

  return (
    <div class="fixed inset-0 z-[1000] flex flex-col overflow-y-auto select-none bg-canvas" onContextMenu={(e) => e.preventDefault()}>
      {/* Top bar */}
      <header class={cx("sticky top-0 z-[2] hero-aurora-soft text-white shadow-[0_10px_30px_-10px_rgba(29,14,33,0.5)] transition", behind())}>
        <div class="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_minmax(180px,360px)_auto] items-center gap-x-3 gap-y-2.5 md:gap-6 max-w-[1280px] mx-auto px-4 md:px-6 py-3 pt-[max(env(safe-area-inset-top),12px)]">
          <div class="flex items-center gap-3 min-w-0">
            <span class="hidden sm:grid place-items-center shrink-0 w-10 h-10 rounded-xl glass">
              <GraduationCap size={19} class="text-lime-300" />
            </span>
            <div class="grid min-w-0 leading-tight">
              <strong class="truncate text-[15.5px] font-semibold">{s.attempt?.departmentName} test</strong>
              <span class="text-[12.5px] text-white/60 truncate">
                <span class="hidden sm:inline">{s.attempt?.name} · </span>Attempt {s.attempt?.attemptNumber ?? 1} of {s.attempt?.maxAttempts ?? "—"}
              </span>
            </div>
          </div>
          <div class="col-span-full row-start-2 md:col-span-1 md:row-start-auto grid gap-1.5 text-[12.5px] font-medium text-white/70">
            <span class="flex justify-between">
              <span>
                {answeredCount()} of {questions().length} answered
              </span>
              <span class="hidden sm:inline-flex items-center gap-1 text-white/50">
                <Lock size={11} /> Training locked
              </span>
            </span>
            <div class="h-1.5 rounded-full overflow-hidden bg-white/15">
              <div
                class="h-full rounded-full bg-gradient-to-r from-lime-300 to-lime-400 transition-[width] duration-300"
                style={{ width: `${(answeredCount() / (questions().length || 1)) * 100}%` }}
              />
            </div>
          </div>
          <div
            role="timer"
            aria-label={`Time remaining ${fmtClock(s.remaining)}`}
            class={cx(
              "relative inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 pt-1.5 sm:pt-2 pb-2 sm:pb-2.5 rounded-xl overflow-hidden font-semibold shadow-[0_6px_16px_rgba(0,0,0,0.2)]",
              lowTime() ? "bg-crimson-500 text-white" : "bg-lime-400 text-plum-950",
              lowTime() && !s.paused && "animate-pulse",
              s.paused && "opacity-75",
            )}
          >
            <Timer size={18} />
            <span class="text-[18px] md:text-[21px] tabular tracking-wide">{fmtClock(s.remaining)}</span>
            <span class="absolute inset-x-0 bottom-0 h-[3px] bg-black/10">
              <span class="block h-full bg-current opacity-60 transition-[width] duration-1000 ease-linear" style={{ width: `${timePct()}%` }} />
            </span>
          </div>
        </div>
        <span class="absolute inset-x-0 bottom-0 h-px hairline opacity-70" />
      </header>

      <div class={cx("grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start w-full max-w-[1280px] mx-auto px-3 pt-3 pb-[calc(96px+env(safe-area-inset-bottom))] md:px-6 md:py-7 transition", behind())}>
        {/* Phones: question numbers as a strip */}
        <div class="lg:hidden flex gap-2 overflow-x-auto no-scrollbar px-1 py-1 -mb-1">
          <For each={questions()}>
            {(item, i) => {
              const answered = () => s.answers[item.id] !== undefined;
              return (
                <button
                  onClick={() => go(i())}
                  aria-label={`Question ${i() + 1}${answered() ? ", answered" : ""}`}
                  class={cx(
                    "relative shrink-0 w-10 h-10 rounded-xl border-[1.5px] text-[14px] font-semibold transition",
                    answered() ? "bg-plum-700 border-plum-700 text-white dark:bg-lime-400 dark:border-lime-400 dark:text-plum-950" : "bg-surface border-line text-ink-2",
                    s.current === i() && "ring-[3px] ring-lime-400/70 dark:ring-plum-400/70",
                  )}
                >
                  {i() + 1}
                  <Show when={flags()[item.id]}>
                    <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-canvas" />
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
        <main class="card p-4 sm:p-9 grid gap-5 sm:gap-6">
          <Show when={q()}>
            <div class="flex items-center justify-between gap-3">
              <p class="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-plum-600 dark:text-lime-300">
                Question {s.current + 1} <span class="font-medium text-muted normal-case tracking-normal">of {questions().length}</span>
              </p>
              <button
                class={cx("btn btn-sm", flags()[q().id] ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "btn-ghost")}
                onClick={toggleFlag}
                aria-pressed={!!flags()[q().id]}
              >
                <Flag size={14} /> {flags()[q().id] ? "Flagged" : <><span class="sm:hidden">Flag</span><span class="hidden sm:inline">Flag for review</span></>}
              </button>
            </div>
            <h2 class="text-[19px] sm:text-[24px] leading-snug font-semibold tracking-[-0.02em]">{q().text}</h2>
            <div class="grid gap-3" role="radiogroup" aria-label="Answer options">
              <For each={q().options}>
                {(opt, i) => {
                  const picked = () => s.answers[q().id] === opt.id;
                  return (
                    <button
                      role="radio"
                      aria-checked={picked()}
                      onClick={() => choose(opt.id)}
                      class={cx(
                        "group flex items-center gap-3 sm:gap-4 w-full px-3.5 sm:px-5 py-3.5 sm:py-4 rounded-2xl border-[1.5px] text-left text-[15.5px] sm:text-[16px] font-medium transition duration-200 active:scale-[0.99]",
                        picked()
                          ? "border-plum-600 bg-plum-50 ring-4 ring-plum-100 dark:border-lime-400 dark:bg-lime-400/10 dark:ring-lime-400/10"
                          : "border-line bg-surface hover:border-line-strong hover:bg-sunken/40 hover:translate-x-0.5",
                      )}
                    >
                      <span
                        class={cx(
                          "grid place-items-center shrink-0 w-9 h-9 rounded-xl border text-[14px] font-semibold transition",
                          picked()
                            ? "bg-plum-700 border-transparent text-white dark:bg-lime-400 dark:text-plum-950"
                            : "bg-sunken/70 border-line text-ink-2 group-hover:border-line-strong",
                        )}
                      >
                        {LETTERS[i()]}
                      </span>
                      <span class="flex-1">{opt.text}</span>
                    </button>
                  );
                }}
              </For>
            </div>
            <p class="hidden md:block text-[13px] text-muted">Tip: press A–D or 1–4 to answer, ← → to move between questions.</p>
            <div class="hidden sm:flex justify-between gap-2.5 pt-5 border-t border-line">
              <button class="btn btn-secondary" disabled={s.current === 0} onClick={() => go(s.current - 1)}>
                <ChevronLeft size={16} /> Previous
              </button>
              <Show
                when={!isLast()}
                fallback={
                  <button class="btn btn-primary" onClick={() => setConfirmSubmit(true)}>
                    <Send size={15} /> Submit test
                  </button>
                }
              >
                <button class="btn btn-primary" onClick={() => go(s.current + 1)}>
                  Next <ChevronRight size={16} />
                </button>
              </Show>
            </div>
          </Show>
        </main>

        <aside class="hidden lg:grid card p-5 gap-4 lg:sticky lg:top-[96px]">
          <p class="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Question navigator</p>
          <div class="grid grid-cols-5 gap-2">
            <For each={questions()}>
              {(item, i) => {
                const answered = () => s.answers[item.id] !== undefined;
                return (
                  <button
                    onClick={() => go(i())}
                    aria-label={`Question ${i() + 1}${answered() ? ", answered" : ""}${flags()[item.id] ? ", flagged" : ""}`}
                    class={cx(
                      "relative aspect-square rounded-xl border-[1.5px] text-[14px] font-semibold transition",
                      answered() ? "bg-plum-700 border-plum-700 text-white dark:bg-lime-400 dark:border-lime-400 dark:text-plum-950" : "bg-surface border-line text-ink-2 hover:border-line-strong",
                      s.current === i() && "ring-[3px] ring-lime-400/70 dark:ring-plum-400/70 !border-plum-500 dark:!border-plum-300",
                    )}
                  >
                    {i() + 1}
                    <Show when={flags()[item.id]}>
                      <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-surface" />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
          <div class="flex flex-wrap gap-x-3 gap-y-1.5 text-[12.5px] text-muted">
            <span class="inline-flex items-center gap-1.5">
              <i class="w-3 h-3 rounded bg-plum-700 dark:bg-lime-400" /> Answered
            </span>
            <span class="inline-flex items-center gap-1.5">
              <i class="w-3 h-3 rounded border-[1.5px] border-line bg-surface" /> Not answered
            </span>
            <span class="inline-flex items-center gap-1.5">
              <i class="w-2.5 h-2.5 rounded-full bg-amber-400" /> Flagged
            </span>
          </div>
          <Show when={s.violations > 0}>
            <p class="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300">
              <TriangleAlert size={15} /> Left the test {s.violations} time{s.violations === 1 ? "" : "s"}
            </p>
          </Show>
          <button class="btn btn-primary w-full" onClick={() => setConfirmSubmit(true)}>
            <Send size={15} /> Submit test
          </button>
        </aside>
      </div>

      {/* Phones: Previous / Next (or Submit) within thumb reach */}
      <div class={cx("sm:hidden fixed bottom-0 inset-x-0 z-[3] bg-surface/95 backdrop-blur-xl border-t border-line px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] grid grid-cols-[auto_1fr] gap-2.5", behind())}>
        <button class="btn btn-secondary h-12 px-4" disabled={s.current === 0} onClick={() => go(s.current - 1)} aria-label="Previous question">
          <ChevronLeft size={18} />
        </button>
        <Show
          when={!isLast()}
          fallback={
            <button class="btn btn-primary h-12" onClick={() => setConfirmSubmit(true)}>
              <Send size={16} /> Submit test
            </button>
          }
        >
          <button class="btn btn-primary h-12" onClick={() => go(s.current + 1)}>
            Next question <ChevronRight size={18} />
          </button>
        </Show>
      </div>

      <Show when={confirmSubmit()}>
        <Modal onClose={() => !submitting() && setConfirmSubmit(false)} labelledBy="submit-title" size="sm">
          <div class="grid justify-items-center gap-3.5 text-center">
            <span class="grid place-items-center w-14 h-14 rounded-2xl bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-300">
              <Send size={22} />
            </span>
            <h2 id="submit-title" class="text-xl font-semibold">Submit your test?</h2>
            <p class="text-[14.5px] text-muted">
              You've answered <strong class="text-ink">{answeredCount()}</strong> of {questions().length} questions with{" "}
              <strong class="text-ink tabular">{fmtClock(s.remaining)}</strong> left.
            </p>
            <Show when={unanswered() > 0}>
              <p class="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[14px] text-left bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <TriangleAlert size={15} class="shrink-0 mt-0.5" /> {unanswered()} question{unanswered() === 1 ? " is" : "s are"} unanswered and will be marked as
                not attempted.
              </p>
            </Show>
            <Show when={Object.values(flags()).some(Boolean)}>
              <p class="text-[13.5px] text-muted">You still have flagged questions to review.</p>
            </Show>
            <Show when={submitError()}>
              <p class="error-text">{submitError()}</p>
            </Show>
            <div class="grid grid-cols-2 gap-2.5 w-full mt-1">
              <button class="btn btn-secondary" disabled={submitting()} onClick={() => setConfirmSubmit(false)}>
                Keep working
              </button>
              <button class="btn btn-primary" disabled={submitting()} onClick={() => submit(false)}>
                {submitting() ? "Submitting…" : "Submit now"}
              </button>
            </div>
          </div>
        </Modal>
      </Show>

      <Show when={s.paused}>
        <Blocking>
          <div role="alertdialog" aria-modal="true" aria-labelledby="pause-title" class="contents">
            <span class="grid place-items-center w-16 h-16 rounded-full bg-crimson-50 text-crimson-600 dark:bg-crimson-500/15 dark:text-crimson-300 animate-ring">
              <TriangleAlert size={26} />
            </span>
            <h2 id="pause-title" class="text-xl font-semibold">Test paused</h2>
            <p class="font-semibold text-crimson-600 dark:text-crimson-300">{PAUSE_COPY[s.pauseReason] || PAUSE_COPY.left}</p>
            <p class="text-[14.5px] text-muted">
              The timer has stopped and your answers are saved. Please stay on this window until you finish — every time you leave is recorded on your
              result.
            </p>
            <div class="grid grid-cols-3 gap-2.5 w-full">
              <For
                each={[
                  [fmtClock(s.remaining), "Time left", false],
                  [`${answeredCount()}/${questions().length}`, "Answered", false],
                  [s.violations, "Warnings", s.violations > 0],
                ]}
              >
                {([v, l, warn]) => (
                  <div class={cx("py-3 rounded-2xl border", warn ? "bg-crimson-50 border-transparent dark:bg-crimson-500/15" : "bg-sunken/70 border-line")}>
                    <p class={cx("text-lg font-semibold tabular", warn && "text-crimson-600 dark:text-crimson-300")}>{v}</p>
                    <p class="text-[13px] text-muted">{l}</p>
                  </div>
                )}
              </For>
            </div>
            <button class="btn btn-primary w-full" onClick={() => setS({ paused: false, pauseReason: null })} autofocus>
              <Play size={15} /> Resume test
            </button>
          </div>
        </Blocking>
      </Show>

      <Show when={submitting() && !confirmSubmit()}>
        <Blocking>
          <div class="w-11 h-11 rounded-full border-[3px] border-line border-t-plum-600 dark:border-t-lime-400 animate-spin" />
          <h2 class="text-xl font-semibold">{s.remaining <= 0 ? "Time's up — submitting…" : "Submitting…"}</h2>
          <p class="text-[14px] text-muted">Grading your answers. Your scoreboard is next.</p>
          <Show when={submitError()}>
            <p class="error-text">{submitError()}</p>
            <button class="btn btn-primary" onClick={() => submit(s.remaining <= 0)}>
              Try again
            </button>
          </Show>
        </Blocking>
      </Show>
    </div>
  );
}

// Blocking overlay for the pause warning and the submit spinner — above modals.
function Blocking(props) {
  return (
    <div class="fixed inset-0 z-[1200] grid place-items-center p-4 bg-plum-950/70 backdrop-blur-md animate-fade-in">
      <div class="grid justify-items-center gap-3.5 w-full max-w-[460px] p-7 text-center rounded-[24px] bg-surface border border-line shadow-float animate-pop">
        {props.children}
      </div>
    </div>
  );
}
