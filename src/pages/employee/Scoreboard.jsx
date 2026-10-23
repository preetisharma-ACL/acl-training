// Scoreboard: one result in detail (the one just submitted, or any from the
// history), with the answer review and the employee's attempt history.

import { createResource, createSignal, createMemo, For, Show, Index } from "solid-js";
import {
  Trophy,
  CircleCheck,
  CircleX,
  Clock,
  Target,
  TriangleAlert,
  ListChecks,
  RotateCcw,
  ArrowRight,

  LayoutDashboard,
  ChevronDown,
  Info,
} from "lucide-solid";
import { Dynamic } from "solid-js/web";
import { Link, navigate, query } from "../../lib/router";
import { cx, fmtDate, fmtDateTime, fmtDuration } from "../../lib/format";
import { user } from "../../store/auth";
import { listMyAttempts, getAttempt, getMyModule } from "../../services/training";
import { ProgressRing, Skeleton, EmptyState, Tabs, CountUp, SectionTitle } from "../../components/ui";

const LETTERS = ["A", "B", "C", "D"];

export default function Scoreboard(props) {
  const me = user();
  const [history] = createResource(() => listMyAttempts(me));
  const [mod] = createResource(() => getMyModule(me));
  const selectedId = () => props.params.id ?? history()?.[0]?.id;
  const [result] = createResource(selectedId, (id) => getAttempt(me, id));
  const fresh = query().get("fresh") === "1";

  return (
    <div class="grid gap-6">
      <Show
        when={!history.loading}
        fallback={
          <>
            <Skeleton class="h-[300px] !rounded-[28px]" />
            <Skeleton class="h-[120px]" />
          </>
        }
      >
        <Show
          when={history()?.length}
          fallback={
            <div class="card">
              <EmptyState
                icon={<Trophy size={26} />}
                title="Your scoreboard is waiting"
                action={
                  <Link href="/training" class="btn btn-primary">
                    Go to training <ArrowRight size={15} />
                  </Link>
                }
              >
                Complete your required materials and take the assessment. Your score and a full answer review will appear here.
              </EmptyState>
            </div>
          }
        >
          <Show when={result()} fallback={<Skeleton class="h-[300px] !rounded-[28px]" />}>
            <ResultHero r={result()} me={me} fresh={fresh} mod={mod()} />
            <StatsGrid r={result()} />
            <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
              <Review r={result()} />
              <History history={history()} selected={selectedId()} />
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

// Light confetti for a fresh pass. Pure CSS, removed after it falls.
function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <For each={pieces}>
        {(i) => (
          <span
            class="absolute top-[-12px] w-2 h-3 rounded-[2px]"
            style={{
              left: `${(i * 37) % 100}%`,
              background: ["#C7E848", "#ADCF2C", "#A877B2", "#542C5F"][i % 4],
              animation: `confetti ${2.2 + (i % 5) * 0.35}s cubic-bezier(.3,.7,.4,1) ${(i % 9) * 0.08}s both`,
              transform: `rotate(${i * 29}deg)`,
            }}
          />
        )}
      </For>
      <style>{`@keyframes confetti { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(420px) rotate(540deg); opacity: 0; } }`}</style>
    </div>
  );
}

function ResultHero(props) {
  const r = () => props.r;
  const first = props.me.name.split(" ")[0];
  const canRetake = () => props.mod?.eligible && !props.mod?.passed;
  const gap = () => Math.max(0, Math.round((r().passPercent - r().percentage) * 10) / 10);

  return (
    <section class="relative isolate overflow-hidden rounded-[28px] border border-line shadow-lift bg-gradient-to-br from-ivory via-surface to-lime-50 dark:from-plum-950 dark:via-surface dark:to-surface">
      {/* Decorative shapes in plum, lime and ivory */}
      <div class="pointer-events-none absolute inset-0 -z-[1]" aria-hidden="true">
        <div class="absolute -right-24 -top-28 w-[420px] h-[420px] rounded-full bg-plum-100/80 dark:bg-plum-800/30" />
        <div class="absolute right-[30%] -bottom-16 w-40 h-40 rounded-full bg-lime-200/70 dark:bg-lime-400/10" />
        <div class="absolute right-[42%] top-8 w-7 h-7 rounded-lg rotate-12 bg-lime-400 shadow-[0_8px_18px_-6px_rgba(173,207,44,0.8)]" />
        <div class="absolute -left-10 -bottom-12 w-36 h-36 rounded-full border-[14px] border-plum-200/70 dark:border-plum-700/40" />
        <svg class="absolute right-[36%] bottom-6 w-24 h-8 text-plum-300 dark:text-plum-600" viewBox="0 0 96 32" fill="none">
          <path d="M2 16c8-12 16-12 24 0s16 12 24 0 16-12 24 0 14 12 20 4" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
      </div>
      <Show when={props.fresh && r().passed}>
        <Confetti />
      </Show>

      <div class="relative grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-8 lg:gap-14 items-center p-6 sm:p-10">
        <div class="min-w-0 stagger order-2">
          <span class={cx("badge px-3 py-1.5 text-[12px]", r().passed ? "bg-lime-400 text-plum-950" : "badge-danger")}>
            <Show when={r().passed} fallback={<CircleX size={14} />}>
              <Trophy size={14} />
            </Show>
            {r().passed ? "Passed" : "Not passed"}
          </span>
          <h1 class="mt-4 text-[30px] sm:text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] text-ink">
            {r().passed ? "Well done, " : "Keep going, "}
            <span class="relative inline-block text-plum-700 dark:text-lime-300">
              <span class="absolute left-0 right-0 bottom-1 h-3 rounded-full bg-lime-300/80 dark:bg-lime-400/20 -z-[1]" />
              {first}
            </span>
            {r().passed ? "!" : "."}
          </h1>
          <p class="mt-3 text-[14.5px] text-muted">
            {r().departmentName} assessment · {fmtDateTime(r().submittedAt)}
            <Show when={r().autoSubmitted}> · submitted automatically when time ran out</Show>
          </p>
          <p class="mt-4 text-[15px] font-medium text-ink-2">
            Pass mark {r().passPercent}% — {r().passed ? "you cleared it." : `you needed ${gap()}% more.`}
          </p>

          <div class="mt-7 flex flex-wrap gap-3">
            <Show when={canRetake()}>
              <button class="btn btn-lime" onClick={() => navigate("/training")}>
                <RotateCcw size={16} /> Retake ({props.mod.assessment.attemptsLeft} left)
              </button>
            </Show>
            <button class="btn btn-secondary" onClick={() => navigate("/dashboard")}>
              <LayoutDashboard size={16} /> Dashboard
            </button>
          </div>
        </div>

        {/* Score medallion: plum disc inside a dashed orbit with lime and plum beads */}
        <div class="relative justify-self-center md:justify-self-start order-1 w-[260px] h-[260px] grid place-items-center">
          <div class="absolute inset-0 rounded-full border-2 border-dashed border-plum-300/70 dark:border-plum-500/50 animate-[spin_40s_linear_infinite]" />
          <span class="absolute top-3 right-8 w-4 h-4 rounded-full bg-lime-400 ring-4 ring-surface" />
          <span class="absolute bottom-6 left-5 w-3 h-3 rounded-full bg-plum-500 ring-4 ring-surface" />
          <div class="relative grid place-items-center w-[218px] h-[218px] rounded-full bg-gradient-to-br from-plum-600 to-plum-900">
            <ProgressRing value={r().percentage} size={190} stroke={13} tone={r().passed ? "lime" : "light"} trackClass="stroke-white/15">
              <span class="text-[46px] leading-none font-semibold tracking-[-0.04em] text-white">
                <CountUp value={r().percentage} decimals={r().percentage % 1 ? 1 : 0} />
                <span class="text-[22px] text-white/60">%</span>
              </span>
              <span class="mt-2 text-[11px] uppercase tracking-[0.16em] text-lime-300">Your score</span>
            </ProgressRing>
          </div>
        </div>
      </div>
    </section>
  );
}

// One panel instead of six cards: a segmented bar for how the questions went,
// then a slim row of facts.
function StatsGrid(props) {
  const r = () => props.r;
  const total = () => r().totalQuestions || 1;
  const parts = () => [
    { label: "Correct", value: r().correct, bar: "bg-lime-400", dot: "bg-lime-400" },
    { label: "Incorrect", value: r().incorrect, bar: "bg-plum-600 dark:bg-plum-400", dot: "bg-plum-600 dark:bg-plum-400" },
    { label: "Skipped", value: r().unanswered, bar: "bg-line-strong", dot: "bg-line-strong" },
  ];
  const facts = () => [
    { icon: Target, label: "Marks", value: `${r().marks} / ${r().totalMarks}` },
    { icon: Clock, label: "Time taken", value: fmtDuration(r().timeTakenSeconds), sub: `of ${fmtDuration(r().durationSeconds)}` },
    {
      icon: TriangleAlert,
      label: "Focus warnings",
      value: r().focusViolations,
      sub: r().focusViolations ? "recorded" : "stayed focused",
      warn: r().focusViolations > 0,
    },
  ];

  return (
    <section class="card p-5 sm:p-7">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-[16px] font-semibold tracking-[-0.01em]">Result breakdown</h2>
        <p class="text-[12.5px] text-muted tabular">{r().totalQuestions} questions</p>
      </div>

      {/* Segmented bar: 2px surface gaps between segments, rounded ends. */}
      <div class="flex gap-[2px] h-3.5 mt-4 rounded-full overflow-hidden bg-sunken" role="img" aria-label={`${r().correct} correct, ${r().incorrect} incorrect, ${r().unanswered} skipped`}>
        <For each={parts().filter((x) => x.value > 0)}>
          {(x) => <span class={cx("h-full transition-[width] duration-700", x.bar)} style={{ width: `${(x.value / total()) * 100}%` }} title={`${x.label}: ${x.value}`} />}
        </For>
      </div>
      <div class="flex flex-wrap gap-x-6 gap-y-2 mt-3">
        <For each={parts()}>
          {(x) => (
            <span class="inline-flex items-center gap-2 text-[13px] text-ink-2">
              <span class={cx("w-2.5 h-2.5 rounded-full", x.dot)} />
              {x.label} <strong class="text-ink tabular">{x.value}</strong>
            </span>
          )}
        </For>
      </div>

      <dl class="grid grid-cols-1 sm:grid-cols-3 mt-6 pt-5 border-t border-line gap-y-4">
        <For each={facts()}>
          {(f, i) => (
            <div class={cx("flex items-center gap-3.5 sm:px-6", i() === 0 && "sm:pl-0", i() > 0 && "sm:border-l sm:border-line")}>
              <span
                class={cx(
                  "grid place-items-center shrink-0 w-10 h-10 rounded-full",
                  f.warn ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200",
                )}
              >
                <Dynamic component={f.icon} size={17} />
              </span>
              <div>
                <dt class="text-[12px] text-muted">{f.label}</dt>
                <dd class="text-[18px] font-semibold tabular leading-tight">
                  {f.value}
                  <Show when={f.sub}>
                    <span class="ml-1.5 text-[12px] font-normal text-muted">{f.sub}</span>
                  </Show>
                </dd>
              </div>
            </div>
          )}
        </For>
      </dl>
    </section>
  );
}

function Review(props) {
  const r = () => props.r;
  const [filter, setFilter] = createSignal("all");
  const [open, setOpen] = createSignal(false);
  const items = createMemo(() => {
    const all = (r().review ?? []).map((x, i) => ({ ...x, n: i + 1 }));
    if (filter() === "correct") return all.filter((x) => x.isCorrect);
    if (filter() === "wrong") return all.filter((x) => !x.isCorrect && x.chosen !== null);
    if (filter() === "skipped") return all.filter((x) => x.chosen === null);
    return all;
  });

  return (
    <section class="card p-5 sm:p-6 min-w-0">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="min-w-0">
          <h2 class="text-[16px] font-semibold tracking-[-0.01em]">Answer review</h2>
          <p class="mt-0.5 text-[12.5px] text-muted">
            {r().correct} correct · {r().incorrect} incorrect · {r().unanswered} skipped
          </p>
        </div>
        <Show when={r().review}>
          <button class="btn btn-secondary" onClick={() => setOpen(!open())} aria-expanded={open()}>
            <ListChecks size={16} /> {open() ? "Hide answers" : "View answers"}
            <ChevronDown size={16} class={cx("transition-transform duration-300", open() && "rotate-180")} />
          </button>
        </Show>
      </div>
      <Show
        when={r().review}
        fallback={
          <div class="flex items-start gap-3 mt-5 p-4 rounded-2xl bg-sunken/60 text-[13px] text-muted">
            <Info size={17} class="shrink-0 mt-0.5" />
            A detailed review isn't available for this attempt — it was recorded before answer reviews were kept. Summary scores are shown above.
          </div>
        }
      >
        <Show when={open()}>
        <div class="animate-fade-up">
        <Tabs
          class="mt-5"
          value={filter()}
          onChange={setFilter}
          tabs={[
            { id: "all", label: "All", count: r().review.length },
            { id: "correct", label: "Correct", count: r().correct },
            { id: "wrong", label: "Incorrect", count: r().incorrect },
            { id: "skipped", label: "Skipped", count: r().unanswered },
          ]}
        />
        <div class="grid gap-3 mt-5">
          <For each={items()} fallback={<p class="py-6 text-center text-[13px] text-muted">Nothing in this group.</p>}>
            {(item) => {
              const wrong = !item.isCorrect && item.chosen !== null;
              return (
                <article class="relative p-5 rounded-2xl border border-line bg-surface overflow-hidden">
                  <span class={cx("absolute left-0 inset-y-0 w-1", item.isCorrect ? "bg-emerald-500" : wrong ? "bg-crimson-500" : "bg-line-strong")} />
                  <p class="flex flex-wrap items-center gap-2.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Question {item.n}
                    <span class={cx("badge normal-case tracking-normal", item.isCorrect ? "badge-success" : wrong ? "badge-danger" : "badge-neutral")}>
                      {item.isCorrect ? "Correct" : item.chosen === null ? "Not attempted" : "Incorrect"}
                    </span>
                  </p>
                  <h3 class="mt-2 text-[15px] font-semibold leading-snug">{item.text}</h3>
                  <ul class="grid gap-1.5 mt-3">
                    <Index each={item.options}>
                      {(opt, oi) => {
                        const isCorrect = oi === item.correctIndex;
                        const isWrong = oi === item.chosen && !item.isCorrect;
                        return (
                          <li
                            class={cx(
                              "flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px]",
                              isCorrect
                                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                                : isWrong
                                  ? "bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-200"
                                  : "text-ink-2",
                            )}
                          >
                            <span
                              class={cx(
                                "grid place-items-center shrink-0 w-6 h-6 rounded-lg text-[11px] font-bold border",
                                isCorrect ? "bg-emerald-600 border-transparent text-white" : isWrong ? "bg-crimson-600 border-transparent text-white" : "bg-sunken border-line",
                              )}
                            >
                              {LETTERS[oi]}
                            </span>
                            <span class="flex-1">{opt()}</span>
                            <Show when={isCorrect}>
                              <span class="text-[11.5px] font-semibold">Correct answer</span>
                            </Show>
                            <Show when={isWrong}>
                              <span class="text-[11.5px] font-semibold">Your answer</span>
                            </Show>
                          </li>
                        );
                      }}
                    </Index>
                  </ul>
                </article>
              );
            }}
          </For>
        </div>
        </div>
        </Show>
      </Show>
    </section>
  );
}

function History(props) {
  return (
    <section class="card p-5 sm:p-6 xl:sticky xl:top-[92px]">
      <SectionTitle title="Attempt history" subtitle={`${props.history.length} attempt${props.history.length === 1 ? "" : "s"}`} />
      <ol class="relative mt-5 grid gap-1">
        <span class="absolute left-[23px] top-3 bottom-3 w-px bg-line" />
        <For each={props.history}>
          {(a) => {
            const on = () => a.id === props.selected;
            return (
              <li>
                <Link
                  href={`/scoreboard/${a.id}`}
                  class={cx("relative flex items-center gap-3.5 p-2 rounded-2xl transition", on() ? "bg-plum-50 dark:bg-lime-400/10" : "hover:bg-sunken/60")}
                >
                  <span
                    class={cx(
                      "relative z-[1] grid place-items-center shrink-0 w-[30px] h-[30px] ml-[8px] rounded-full ring-4 ring-surface",
                      a.passed ? "bg-lime-400 text-plum-950" : "bg-crimson-50 text-crimson-600 dark:bg-crimson-500/20 dark:text-crimson-300",
                    )}
                  >
                    <Show when={a.passed} fallback={<CircleX size={15} />}>
                      <CircleCheck size={15} />
                    </Show>
                  </span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-[13.5px] font-semibold tabular">{a.percentage}%</span>
                    <span class="block text-[11.5px] text-muted truncate">{fmtDate(a.submittedAt)} · {a.marks}/{a.totalMarks}</span>
                  </span>
                  <Show when={on()}>
                    <span class="badge badge-plum">Viewing</span>
                  </Show>
                </Link>
              </li>
            );
          }}
        </For>
      </ol>
      <Link href="/training" class="btn btn-secondary w-full mt-5">
        <ListChecks size={15} /> Back to training
      </Link>
    </section>
  );
}
