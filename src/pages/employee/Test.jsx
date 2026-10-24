// Test: everything before the employee starts their test — what it is, what
// still needs doing, and one clear Start button. Starting opens the rules
// sheet, then the live test (/assessment), which locks the rest of the app.

import { batch, createResource, createSignal, For, Show } from "solid-js";
import {
  ArrowRight,
  BookOpen,
  Lock,
  LockOpen,
  CircleCheck,
  Circle,
  ListChecks,
  Timer,
  Target,
  RotateCcw,
  Play,
  Eye,
  Clock,
  Send,
  ShieldCheck,
  Trophy,
  Info,
} from "lucide-solid";
import { Link, navigate } from "../../lib/router";
import { cx } from "../../lib/format";
import { user } from "../../store/auth";
import { beginSession } from "../../store/assessment";
import { getMyModule, startAttempt } from "../../services/training";
import { Skeleton, Modal, EmptyState } from "../../components/ui";

export default function Test() {
  const me = user();
  const [mod] = createResource(() => getMyModule(me));

  return (
    <div class="grid gap-5 max-w-[760px] mx-auto">
      <div class="hidden md:block">
        <p class="kicker mb-2">Step 2 of 3</p>
        <h1 class="text-[28px] font-semibold tracking-[-0.025em]">Your test</h1>
      </div>

      <Show when={mod()} fallback={<Skeleton class="h-[520px] !rounded-2xl" />}>
        <Show
          when={mod().department}
          fallback={
            <div class="card">
              <EmptyState icon={<Info size={24} />} title="No test assigned yet">
                Your designation ({me.designation?.title ?? "not set"}) doesn't have a test yet. Please contact HR or your training admin.
              </EmptyState>
            </div>
          }
        >
          <TestCard mod={mod()} me={me} />
        </Show>
      </Show>
    </div>
  );
}

function TestCard(props) {
  const mod = () => props.mod;
  const a = () => mod().assessment;
  const [ack, setAck] = createSignal(false);
  const [rules, setRules] = createSignal(false);
  const [starting, setStarting] = createSignal(false);
  const [error, setError] = createSignal(null);
  const blocker = () => mod().conditions.find((c) => !c.met);

  const begin = async () => {
    setStarting(true);
    setError(null);
    try {
      const attempt = await startAttempt(props.me);
      batch(() => {
        beginSession(attempt);
        navigate("/assessment", { replace: true });
      });
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  };

  return (
    <>
      {/* Summary */}
      <section class="card overflow-hidden">
        <div class="p-5 sm:p-6 bg-gradient-to-br from-white via-plum-50 to-lime-50 dark:from-surface dark:via-plum-900/30 dark:to-surface border-b border-line">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[13px] font-medium text-muted">{mod().department.name}</p>
              <h2 class="mt-0.5 text-[22px] font-semibold leading-tight">{a().title} test</h2>
            </div>
            <span class={cx("badge shrink-0 px-2.5 py-1", mod().passed ? "badge-success" : mod().eligible ? "badge-lime" : "badge-neutral")}>
              <Show when={mod().eligible} fallback={<Lock size={12} />}>
                <LockOpen size={12} />
              </Show>
              {mod().passed ? "Passed" : mod().eligible ? "Ready" : "Locked"}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-5">
            <For
              each={[
                [ListChecks, a().questionCount, "Questions"],
                [Timer, `${a().durationMinutes} min`, "Time"],
                [Target, `${a().passPercent}%`, "To pass"],
              ]}
            >
              {([Icon, v, l]) => (
                <div class="px-2 py-3 rounded-xl bg-surface/80 border border-line text-center">
                  <Icon size={16} class="mx-auto text-plum-600 dark:text-lime-300" />
                  <p class="mt-1.5 text-[18px] font-semibold tabular leading-none">{v}</p>
                  <p class="mt-1 text-[12px] text-muted">{l}</p>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Checklist */}
        <div class="p-5 sm:p-6">
          <p class="text-[13px] font-semibold text-ink-2">Before you start</p>
          <ul class="grid gap-3 mt-3">
            <For each={mod().conditions}>
              {(c) => (
                <li class="flex items-start gap-3">
                  <span
                    class={cx(
                      "grid place-items-center shrink-0 w-7 h-7 rounded-full",
                      c.met ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-sunken text-muted",
                    )}
                  >
                    <Show when={c.met} fallback={<Circle size={13} />}>
                      <CircleCheck size={16} />
                    </Show>
                  </span>
                  <span class="min-w-0 pt-0.5">
                    <span class={cx("block text-[15px] font-medium", c.met ? "text-ink" : "text-ink-2")}>{c.label}</span>
                    <span class="block text-[13px] text-muted">{c.detail}</span>
                  </span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </section>

      {/* Action */}
      <section class="card p-5 sm:p-6">
        <Show
          when={mod().eligible}
          fallback={
            <Show
              when={blocker()?.id === "materials"}
              fallback={
                <div class="flex items-start gap-3">
                  <span class="grid place-items-center shrink-0 w-10 h-10 rounded-xl badge-warn">
                    <Info size={18} />
                  </span>
                  <p class="text-[14.5px] text-ink-2 leading-relaxed">
                    {blocker()?.id === "attempts"
                      ? "You've used all your attempts. Your training admin can give you another one."
                      : "Your test isn't ready yet. Please check back later or contact your training admin."}
                  </p>
                </div>
              }
            >
              <div class="grid gap-4">
                <div class="flex items-start gap-3">
                  <span class="grid place-items-center shrink-0 w-10 h-10 rounded-xl bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-300">
                    <BookOpen size={18} />
                  </span>
                  <div>
                    <p class="text-[15px] font-semibold">Finish your training first</p>
                    <p class="text-[14px] text-muted">
                      {mod().requiredCount - mod().completedRequired} required module{mod().requiredCount - mod().completedRequired === 1 ? "" : "s"} left. The test unlocks when
                      they're done.
                    </p>
                  </div>
                </div>
                <button class="btn btn-primary btn-lg w-full" onClick={() => navigate("/training")}>
                  Go to training <ArrowRight size={17} />
                </button>
              </div>
            </Show>
          }
        >
          <label class="flex items-start gap-3 p-3.5 rounded-xl border border-line bg-sunken/40 cursor-pointer select-none">
            <input type="checkbox" checked={ack()} onChange={(e) => setAck(e.currentTarget.checked)} class="w-5 h-5 mt-0.5 shrink-0 accent-plum-700 dark:accent-lime-400" />
            <span class="text-[14.5px] text-ink-2">I've read my training material and I'm ready to start.</span>
          </label>
          <button class="btn btn-primary btn-lg w-full mt-4" disabled={!ack()} onClick={() => setRules(true)}>
            <Show when={a().attemptsUsed} fallback={<Play size={17} />}>
              <RotateCcw size={17} />
            </Show>
            {a().attemptsUsed ? `Retake test (attempt ${a().attemptsUsed + 1} of ${a().maxAttempts})` : "Start test"}
          </button>
          <p class="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-muted">
            <Lock size={12} /> Training is locked while the test runs
          </p>
        </Show>

        <Show when={mod().best}>
          <Link href={`/scoreboard/${mod().best.id}`} class="flex items-center gap-3 mt-4 p-3.5 rounded-xl bg-sunken/60 border border-line hover:border-line-strong transition">
            <Trophy size={18} class="text-plum-600 dark:text-lime-300" />
            <span class="text-[14.5px] flex-1">
              Your best score <strong class="tabular">{mod().best.percentage}%</strong>
            </span>
            <ArrowRight size={16} class="text-muted" />
          </Link>
        </Show>
      </section>

      <Show when={rules()}>
        <Modal onClose={() => !starting() && setRules(false)} labelledBy="rules-title" size="md">
          <div class="grid gap-4">
            <div class="text-center">
              <h2 id="rules-title" class="text-[20px] font-semibold">Before you begin</h2>
              <p class="mt-1 text-[14px] text-muted">
                Attempt {a().attemptsUsed + 1} of {a().maxAttempts} · {a().questionCount} questions · {a().durationMinutes} min
              </p>
            </div>
            <ul class="grid gap-3">
              <For
                each={[
                  [Lock, "Training is locked until you submit."],
                  [Eye, "Leaving this screen or switching apps pauses the test and is recorded."],
                  [Clock, "Your answers are saved — you can resume where you stopped."],
                  [Send, "The test submits automatically when time runs out."],
                  [ShieldCheck, "Each question has four options and one correct answer."],
                ]}
              >
                {([Icon, text]) => (
                  <li class="flex items-start gap-3 text-[14.5px] text-ink-2">
                    <span class="grid place-items-center shrink-0 w-8 h-8 rounded-lg bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-300">
                      <Icon size={15} />
                    </span>
                    <span class="pt-1">{text}</span>
                  </li>
                )}
              </For>
            </ul>
            <Show when={error()}>
              <p class="error-text">{error()}</p>
            </Show>
            <div class="grid gap-2.5 mt-1">
              <button class="btn btn-primary btn-lg w-full" disabled={starting()} onClick={begin}>
                <Play size={16} /> {starting() ? "Starting…" : "Begin test"}
              </button>
              <button class="btn btn-ghost w-full" disabled={starting()} onClick={() => setRules(false)}>
                Not yet
              </button>
            </div>
          </div>
        </Modal>
      </Show>
    </>
  );
}
