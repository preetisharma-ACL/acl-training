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
  FileText,
  LayoutDashboard,
  ChevronDown,
  Info,
  Award,
  Medal,
  Users,
  BarChart3,
} from "lucide-solid";
import { Dynamic } from "solid-js/web";
import { Link, navigate, query } from "../../lib/router";
import { cx, fmtDate, fmtDateTime, fmtDuration } from "../../lib/format";
import { user } from "../../store/auth";
import { listMyAttempts, getAttempt, getMyModule, certificateUrl } from "../../services/training";
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
                Finish your training and take your test. Your score and a full answer review will appear here.
              </EmptyState>
            </div>
          }
        >
          <Show when={result()} fallback={<Skeleton class="h-[300px] !rounded-[28px]" />}>
            <ResultHero r={result()} me={me} fresh={fresh} mod={mod()} />
            <StatsGrid r={result()} />
            <Show when={result().standing?.of}>
              <Standing s={result().standing} department={result().departmentName} />
            </Show>
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
              background: ["#3463AF", "#86B4FF", "#F59E0B", "#10B981"][i % 4],
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

  const counts = () => [
    { label: "Correct", value: r().correct, class: "text-emerald-600 dark:text-emerald-400" },
    { label: "Wrong", value: r().incorrect, class: "text-crimson-600 dark:text-crimson-300" },
    { label: "Total", value: r().totalQuestions, class: "text-ink" },
  ];

  return (
    <section class="relative isolate overflow-hidden rounded-[28px] border border-line shadow-lift bg-gradient-to-r from-surface via-surface to-plum-50 dark:from-surface dark:via-surface dark:to-plum-950">
      {/* Soft glows and dot grids */}
      <div class="pointer-events-none absolute inset-0 -z-[1]" aria-hidden="true">
        <div class={cx("absolute -left-24 -bottom-28 w-[340px] h-[340px] rounded-full blur-3xl", r().passed ? "bg-emerald-100/60 dark:bg-emerald-500/10" : "bg-crimson-100/60 dark:bg-crimson-500/10")} />
        <div class="absolute -right-20 -top-24 w-[380px] h-[380px] rounded-full bg-plum-100/70 dark:bg-plum-800/25" />
        <DotGrid class="left-6 top-6" />
        <DotGrid class="right-6 top-6 hidden lg:grid" />
      </div>
      <Show when={props.fresh && r().passed}>
        <Confetti />
      </Show>

      <div class="relative grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_240px] gap-5 sm:gap-7 lg:gap-9 items-center p-5 sm:p-6 lg:px-8 lg:py-6">
        {/* Score ring + counts */}
        <div class="grid gap-3 justify-items-center w-full md:w-[190px]">
          <div class="grid place-items-center w-[164px] h-[164px] rounded-full bg-surface shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)]">
            <ProgressRing value={r().percentage} size={142} stroke={10} tone={r().passed ? "success" : "danger"} trackClass="stroke-sunken">
              <span class="text-[38px] leading-none font-bold tracking-[-0.04em] text-ink tabular">
                <CountUp value={r().percentage} decimals={r().percentage % 1 ? 1 : 0} />
                <span class="text-[18px]">%</span>
              </span>
              <span class="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-plum-700 dark:text-lime-400">Your score</span>
            </ProgressRing>
          </div>
          <dl class="grid grid-cols-3 w-full max-w-[220px] py-2.5 rounded-2xl bg-surface border border-line shadow-card">
            <For each={counts()}>
              {(c, i) => (
                <div class={cx("text-center", i() > 0 && "border-l border-line")}>
                  <dd class={cx("text-[19px] leading-none font-bold tabular", c.class)}>{c.value}</dd>
                  <dt class="mt-1 text-[12px] text-muted">{c.label}</dt>
                </div>
              )}
            </For>
          </dl>
        </div>

        {/* Message, facts and actions */}
        <div class="min-w-0 stagger">
          <span
            class={cx(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[13px] font-semibold",
              r().passed
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300"
                : "bg-crimson-50 border-crimson-200 text-crimson-600 dark:bg-crimson-500/15 dark:border-crimson-500/30 dark:text-crimson-300",
            )}
          >
            <Show when={r().passed} fallback={<CircleX size={14} />}>
              <CircleCheck size={14} />
            </Show>
            {r().passed ? "Passed" : "Not Passed"}
          </span>
          <h1 class="mt-2.5 text-[26px] sm:text-[32px] leading-[1.1] font-bold tracking-[-0.03em] text-navy dark:text-white">
            {r().passed ? "Well done, " : "Keep going, "}
            <span class="text-plum-700 dark:text-lime-400">{first}</span>!
          </h1>
          <p class="mt-2 max-w-[520px] text-[14.5px] leading-normal text-ink-2">
            {r().passed
              ? "You cleared the passing criteria. Great work. Your result is saved and your training for this module is complete."
              : "You didn't meet the passing criteria this time, but this is just a step in your learning journey. Keep practicing and you'll do better next time!"}
          </p>

          <div class="grid sm:grid-cols-2 gap-2.5 mt-4 max-w-[600px]">
            <div class="flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-line bg-surface/80">
              <span class="grid place-items-center shrink-0 w-8 h-8 rounded-xl bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200">
                <FileText size={17} />
              </span>
              <div class="min-w-0">
                <p class="text-[14.5px] font-semibold text-ink truncate">Test: {r().departmentName} test</p>
                <p class="text-[13px] text-muted">
                  Completed on {fmtDateTime(r().submittedAt)}
                  <Show when={r().autoSubmitted}> · auto-submitted</Show>
                </p>
              </div>
            </div>
            <div
              class={cx(
                "flex items-center gap-3 px-3 py-2.5 rounded-2xl border",
                r().passed
                  ? "bg-emerald-50/70 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                  : "bg-crimson-50/70 border-crimson-100 dark:bg-crimson-500/10 dark:border-crimson-500/20",
              )}
            >
              <span
                class={cx(
                  "grid place-items-center shrink-0 w-8 h-8 rounded-xl",
                  r().passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-crimson-100 text-crimson-600 dark:bg-crimson-500/20 dark:text-crimson-300",
                )}
              >
                <Target size={17} />
              </span>
              <div class="min-w-0">
                <p class={cx("text-[14.5px] font-semibold", r().passed ? "text-emerald-700 dark:text-emerald-300" : "text-crimson-600 dark:text-crimson-300")}>
                  Pass mark {r().passPercent}%
                </p>
                <p class="text-[13px] text-ink-2">{r().passed ? "You cleared it." : `You needed ${gap()}% more to pass.`}</p>
              </div>
            </div>
          </div>

          <div class="mt-4 grid sm:flex sm:flex-wrap gap-2.5 sm:gap-3">
            <Show when={canRetake()}>
              <button class="btn btn-primary w-full sm:w-auto" onClick={() => navigate("/test")}>
                <RotateCcw size={16} /> Retake test ({props.mod.assessment.attemptsLeft} left)
              </button>
            </Show>
            <Show when={certificateUrl?.(r())}>
              <a class="btn btn-primary w-full sm:w-auto" href={certificateUrl(r())} download>
                <Award size={16} /> Download certificate
              </a>
            </Show>
            <button class="btn btn-secondary w-full sm:w-auto" onClick={() => navigate("/dashboard")}>
              <LayoutDashboard size={16} /> Back to home
            </button>
          </div>
        </div>

        <ResultArt passed={r().passed} />
      </div>
    </section>
  );
}

function DotGrid(props) {
  return (
    <div class={cx("absolute grid grid-cols-4 gap-2", props.class)}>
      <For each={Array.from({ length: 12 })}>{() => <span class="w-1 h-1 rounded-full bg-plum-300/70 dark:bg-plum-600/60" />}</For>
    </div>
  );
}

// Result sheet with a graduation cap and a plant. Red cross on a fail, green tick on a pass.
function ResultArt(props) {
  const mark = () => (props.passed ? "#16A34A" : "#E5484D");
  return (
    <svg viewBox="0 0 300 260" class="hidden lg:block w-full max-w-[240px] justify-self-end" aria-hidden="true">
      <defs>
        <linearGradient id="ra-blob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#DFE8FD" />
          <stop offset="100%" stop-color="#EFF4FF" />
        </linearGradient>
        <filter id="ra-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#3463AF" flood-opacity="0.18" />
        </filter>
      </defs>

      <ellipse cx="160" cy="140" rx="130" ry="110" fill="url(#ra-blob)" class="dark:opacity-20" />
      <ellipse cx="150" cy="238" rx="110" ry="10" fill="#C8D8FF" opacity="0.5" />

      {/* Plant */}
      <g transform="translate(232 150)">
        <path d="M18 70 C10 40 -8 26 -14 4 C6 14 18 34 20 64Z" fill="#7FA4E6" />
        <path d="M22 70 C26 36 40 18 54 6 C52 30 40 52 26 70Z" fill="#5583D0" />
        <path d="M20 70 C14 50 2 44 -10 40 C2 54 10 62 16 72Z" fill="#A9C4F5" />
        <path d="M22 66 C32 52 44 48 56 46 C46 58 34 66 24 72Z" fill="#A9C4F5" />
        <rect x="6" y="68" width="30" height="20" rx="6" fill="#FFFFFF" filter="url(#ra-shadow)" />
      </g>

      {/* Sheet */}
      <g transform="rotate(-8 150 140)" filter="url(#ra-shadow)">
        <rect x="88" y="62" width="128" height="164" rx="16" fill="#FFFFFF" />
      </g>
      <g transform="rotate(-8 150 140)">
        <circle cx="150" cy="104" r="18" fill={mark()} />
        <Show
          when={props.passed}
          fallback={<path d="M143 97 L157 111 M157 97 L143 111" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />}
        >
          <path d="M142 104 L148 110 L159 98" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </Show>
        <For each={[0, 1, 2]}>
          {(i) => {
            const y = 142 + i * 26;
            const bad = !props.passed && i === 2;
            return (
              <>
                <rect x="106" y={y} width="14" height="14" rx="3.5" fill={bad ? "#E5484D" : "#3463AF"} />
                <Show
                  when={bad}
                  fallback={<path d={`M109 ${y + 7} L112 ${y + 10} L117 ${y + 4}`} stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />}
                >
                  <path d={`M110 ${y + 4} L116 ${y + 10} M116 ${y + 4} L110 ${y + 10}`} stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
                </Show>
                <rect x="128" y={y + 2} width={i === 1 ? 52 : 66} height="4" rx="2" fill="#C8D8FF" />
                <rect x="128" y={y + 9} width={i === 1 ? 40 : 50} height="3" rx="1.5" fill="#DFE8FD" />
              </>
            );
          }}
        </For>
      </g>

      {/* Graduation cap */}
      <g transform="translate(176 22) rotate(12)">
        <path d="M18 40 L18 56 C18 64 66 64 66 56 L66 40Z" fill="#1E3A6B" />
        <path d="M0 30 L42 10 L84 30 L42 50Z" fill="#2A5195" />
        <path d="M0 30 L42 50 L84 30 L84 33 L42 53 L0 33Z" fill="#1E3A6B" />
        <path d="M42 30 L72 40 L72 66" stroke="#F59E0B" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <rect x="68" y="64" width="8" height="14" rx="3" fill="#F59E0B" />
        <circle cx="42" cy="30" r="3" fill="#F59E0B" />
      </g>
    </svg>
  );
}

// One panel instead of six cards: a segmented bar for how the questions went,
// then a slim row of facts.
// Department standing, straight from the API (no names, only numbers):
// rank by best score among colleagues who have taken the test, the
// department average of those best scores, and how many have passed.
function Standing(props) {
  const s = () => props.s;
  const ord = (n) => {
    const v = n % 100;
    return n + (v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");
  };
  const cmp = () => {
    if (s().best == null || s().departmentAverage == null) return null;
    const d = Math.round((s().best - s().departmentAverage) * 10) / 10;
    return d > 0 ? `${d}% above the department average` : d < 0 ? `${Math.abs(d)}% below the department average` : "Level with the department average";
  };
  const tiles = () => [
    { icon: Medal, label: "Your rank", value: s().rank ? ord(s().rank) : "—", sub: `of ${s().of} who took the test` },
    { icon: BarChart3, label: "Department average", value: s().departmentAverage != null ? `${s().departmentAverage}%` : "—", sub: "of everyone's best score" },
    { icon: Users, label: "Passed", value: s().passedCount, sub: s().totalEligible ? `of ${s().totalEligible} in the department` : "colleagues" },
  ];
  return (
    <section class="card p-5 sm:p-7">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-[16px] font-semibold tracking-[-0.01em]">Department standing</h2>
        <p class="text-[13.5px] text-muted">{props.department} · ranked by each person's best score</p>
      </div>
      <dl class="grid grid-cols-1 sm:grid-cols-3 mt-5 gap-3">
        <For each={tiles()}>
          {(t) => (
            <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-sunken/60">
              <span class="grid place-items-center shrink-0 w-10 h-10 rounded-xl bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200">
                <Dynamic component={t.icon} size={18} />
              </span>
              <div class="min-w-0">
                <dt class="text-[12.5px] text-muted">{t.label}</dt>
                <dd class="text-[20px] leading-tight font-bold tabular text-ink">{t.value}</dd>
                <p class="text-[12.5px] text-muted truncate">{t.sub}</p>
              </div>
            </div>
          )}
        </For>
      </dl>
      <Show when={cmp()}>
        <p class="mt-3 text-[13.5px] text-ink-2">
          Your best score is <strong class="tabular">{s().best}%</strong> — {cmp()}.
        </p>
      </Show>
    </section>
  );
}

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
        <p class="text-[13.5px] text-muted tabular">{r().totalQuestions} questions</p>
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
            <span class="inline-flex items-center gap-2 text-[14px] text-ink-2">
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
                <dt class="text-[13px] text-muted">{f.label}</dt>
                <dd class="text-[18px] font-semibold tabular leading-tight">
                  {f.value}
                  <Show when={f.sub}>
                    <span class="ml-1.5 text-[13px] font-normal text-muted">{f.sub}</span>
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
          <p class="mt-0.5 text-[13.5px] text-muted">
            {r().correct} correct · {r().incorrect} incorrect · {r().unanswered} skipped
          </p>
        </div>
        <Show when={r().review}>
          <button class="btn btn-secondary w-full sm:w-auto" onClick={() => setOpen(!open())} aria-expanded={open()}>
            <ListChecks size={16} /> {open() ? "Hide answers" : "View answers"}
            <ChevronDown size={16} class={cx("transition-transform duration-300", open() && "rotate-180")} />
          </button>
        </Show>
      </div>
      <Show
        when={r().review}
        fallback={
          <div class="flex items-start gap-3 mt-5 p-4 rounded-2xl bg-sunken/60 text-[14px] text-muted">
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
          <For each={items()} fallback={<p class="py-6 text-center text-[14px] text-muted">Nothing in this group.</p>}>
            {(item) => {
              const wrong = !item.isCorrect && item.chosen !== null;
              return (
                <article class="relative p-5 rounded-2xl border border-line bg-surface overflow-hidden">
                  <span class={cx("absolute left-0 inset-y-0 w-1", item.isCorrect ? "bg-emerald-500" : wrong ? "bg-crimson-500" : "bg-line-strong")} />
                  <p class="flex flex-wrap items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Question {item.n}
                    <span class={cx("badge normal-case tracking-normal", item.isCorrect ? "badge-success" : wrong ? "badge-danger" : "badge-neutral")}>
                      {item.isCorrect ? "Correct" : item.chosen === null ? "Not attempted" : "Incorrect"}
                    </span>
                  </p>
                  <h3 class="mt-2 text-[16px] font-semibold leading-snug">{item.text}</h3>
                  <ul class="grid gap-1.5 mt-3">
                    <Index each={item.options}>
                      {(opt, oi) => {
                        const isCorrect = oi === item.correctIndex;
                        const isWrong = oi === item.chosen && !item.isCorrect;
                        return (
                          <li
                            class={cx(
                              "flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl text-[14.5px]",
                              isCorrect
                                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                                : isWrong
                                  ? "bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-200"
                                  : "text-ink-2",
                            )}
                          >
                            <span
                              class={cx(
                                "grid place-items-center shrink-0 w-6 h-6 rounded-lg text-[12px] font-bold border",
                                isCorrect ? "bg-emerald-600 border-transparent text-white" : isWrong ? "bg-crimson-600 border-transparent text-white" : "bg-sunken border-line",
                              )}
                            >
                              {LETTERS[oi]}
                            </span>
                            <span class="flex-1">{opt()}</span>
                            <Show when={isCorrect}>
                              <span class="text-[12.5px] font-semibold">Correct answer</span>
                            </Show>
                            <Show when={isWrong}>
                              <span class="text-[12.5px] font-semibold">Your answer</span>
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
                    <span class="block text-[14.5px] font-semibold tabular">{a.percentage}%</span>
                    <span class="block text-[12.5px] text-muted truncate">{fmtDate(a.submittedAt)} · {a.marks}/{a.totalMarks}</span>
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
