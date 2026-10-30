// Personalised dashboard. Everything here is driven by what the backend
// returns for the signed-in user (department and designation included) —
// the employee never chooses either.

import { createResource, For, Show, Switch, Match } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  ArrowRight,
  BookOpen,
  Trophy,
  Clock,
  Target,
  CircleCheck,
  Lock,
  Megaphone,
  MapPin,
  UserRound,
  ListChecks,
  Timer,
  Sparkles,
  CalendarClock,
  Play,
  Check,
  TriangleAlert,
  ArrowUpRight,
} from "lucide-solid";
import { Link, navigate } from "../../lib/router";
import { cx, greeting, fmtDate, fmtRelative, daysUntil, plural } from "../../lib/format";
import { user } from "../../store/auth";
import { getMyModule, listMyAttempts, getAnnouncements } from "../../services/training";
import { ProgressRing, ProgressBar, Skeleton, EmptyState, SectionTitle, IconTile, CountUp } from "../../components/ui";
import { DeptIcon, TypeIcon, MATERIAL_TYPES } from "../../components/icons";

export default function Dashboard() {
  const me = user();
  const [mod] = createResource(() => getMyModule(me));
  const [attempts] = createResource(() => listMyAttempts(me));
  const [news] = createResource(getAnnouncements);

  const readPct = () => (mod()?.requiredCount ? Math.round((mod().completedRequired / mod().requiredCount) * 100) : 0);
  const firstName = me.name.split(" ")[0];

  return (
    <div class="grid gap-4 sm:gap-7">
      <Show when={mod()} fallback={<Skeleton class="h-[260px] !rounded-[24px]" />}>
        <Hero me={me} mod={mod()} readPct={readPct()} firstName={firstName} />
      </Show>

      <Show when={mod()?.department}>
        <Journey mod={mod()} />
      </Show>

      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6 items-start">
        <div class="grid grid-cols-1 gap-4 sm:gap-6 min-w-0">
          <section class="card p-4 sm:p-6">
            <SectionTitle
              title="Your training"
              subtitle={mod() ? `${plural(mod().materials.length, "material")} · ${mod().readingMinutesLeft} min of reading left` : "Loading…"}
              action={
                <Link href="/training" class="btn btn-secondary btn-sm">
                  Open <ArrowRight size={14} />
                </Link>
              }
            />
            <Show when={mod()} fallback={<div class="grid gap-3 mt-5"><Skeleton class="h-16" /><Skeleton class="h-16" /><Skeleton class="h-16" /></div>}>
              <ul class="mt-4 sm:mt-5 grid gap-2.5 stagger">
                <For each={mod().materials.slice(0, 5)}>
                  {(m) => (
                    <li>
                      <Link
                        href={`/training/${m.id}`}
                        class="group flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-2xl border border-line bg-surface hover:border-plum-200 hover:bg-plum-50/40 dark:hover:bg-white/[0.03] transition active:bg-sunken/50"
                      >
                        <span
                          class={cx(
                            "grid place-items-center shrink-0 w-11 h-11 rounded-full transition",
                            m.progress.completed
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200",
                          )}
                        >
                          <Show when={m.progress.completed} fallback={<TypeIcon type={m.type} size={19} />}>
                            <CircleCheck size={19} />
                          </Show>
                        </span>
                        <span class="flex-1 min-w-0">
                          <span class="flex items-center gap-2">
                            <span class="min-w-0 font-semibold text-[15px] truncate">{m.title}</span>
                            <Show when={m.required}>
                              <span class="badge badge-neutral hidden sm:inline-flex">Required</span>
                            </Show>
                          </span>
                          <span class="flex flex-wrap items-center gap-x-2 mt-1 text-[13px] text-muted whitespace-nowrap">
                            <span>{MATERIAL_TYPES[m.type].short}</span>·<span>{m.estMinutes} min</span>
                            <Show when={m.scope === "company"}>
                              ·<span>Company-wide</span>
                            </Show>
                          </span>
                        </span>
                        <span class="hidden sm:block w-28 shrink-0">
                          <Show
                            when={!m.progress.completed}
                            fallback={<span class="badge badge-success float-right"><Check size={12} /> Done</span>}
                          >
                            <span class="flex justify-between text-[12px] text-muted mb-1.5">
                              <span>{m.progress.opened ? "In progress" : "Not started"}</span>
                              <span class="tabular">{m.progress.percent}%</span>
                            </span>
                            <ProgressBar value={m.progress.percent} />
                          </Show>
                        </span>
                        <ArrowRight size={16} class="shrink-0 text-muted group-hover:text-ink group-hover:translate-x-0.5 transition" />
                      </Link>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>

          <section class="card p-4 sm:p-6">
            <SectionTitle
              title="Recent results"
              subtitle="Your test history"
              action={
                <Show when={attempts()?.length}>
                  <Link href="/scoreboard" class="btn btn-ghost btn-sm">
                    View all <ArrowRight size={14} />
                  </Link>
                </Show>
              }
            />
            <Show when={!attempts.loading} fallback={<Skeleton class="h-24 mt-5" />}>
              <Show
                when={attempts()?.length}
                fallback={
                  <EmptyState icon={<Trophy size={24} />} title="No results yet" class="!py-8">
                    Finish your training, then take your test. Your score will appear here.
                  </EmptyState>
                }
              >
                <ul class="mt-4 divide-y divide-line">
                  <For each={attempts().slice(0, 4)}>
                    {(a) => (
                      <li>
                        <Link href={`/scoreboard/${a.id}`} class="flex items-center gap-4 py-3.5 group">
                          <ProgressRing value={a.percentage} size={48} stroke={5} tone={a.passed ? "lime" : "danger"}>
                            <span class="text-[12px] font-semibold tabular">{Math.round(a.percentage)}</span>
                          </ProgressRing>
                          <span class="flex-1 min-w-0">
                            <span class="block font-semibold text-[15px] truncate">{a.departmentName} test</span>
                            <span class="block text-[13px] text-muted">
                              {fmtDate(a.submittedAt)} · {a.marks}/{a.totalMarks} marks
                            </span>
                          </span>
                          <span class={cx("badge", a.passed ? "badge-success" : "badge-danger")}>{a.passed ? "Passed" : "Not passed"}</span>
                          <ArrowRight size={16} class="hidden sm:block text-muted group-hover:text-ink transition" />
                        </Link>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </section>
        </div>

        <aside class="grid gap-4 sm:gap-6">
          <Show when={mod()?.department}>
            <section class="card overflow-hidden">
              <div class="px-5 py-5 bg-tint-blue dark:bg-plum-900/40 border-b border-line">
                <div class="flex items-center gap-3.5">
                  <span class="grid place-items-center w-12 h-12 rounded-full bg-white dark:bg-surface text-plum-700 dark:text-lime-400">
                    <DeptIcon id={mod().department.id} size={22} />
                  </span>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-ink-2">Your department</p>
                    <p class="text-[17px] font-semibold truncate">{mod().department.name}</p>
                  </div>
                </div>
              </div>
              <dl class="grid gap-3 p-5 text-[14px]">
                <Row icon={<UserRound size={15} />} label="Department head" value={mod().department.head} />
                <Row icon={<MapPin size={15} />} label="Location" value={mod().department.location} />
                <Row icon={<ListChecks size={15} />} label="Test" value={`${mod().assessment.questionCount} questions`} />
                <Row icon={<Timer size={15} />} label="Time limit" value={`${mod().assessment.durationMinutes} minutes`} />
                <Row icon={<Target size={15} />} label="Pass mark" value={`${mod().assessment.passPercent}%`} />
              </dl>
            </section>
          </Show>

          <section class="card p-4 sm:p-5">
            <SectionTitle title="Announcements" />
            <div class="mt-4 grid gap-3">
              <For each={news()} fallback={<Skeleton class="h-20" />}>
                {(a) => (
                  <article class={cx("p-4 rounded-2xl", a.tone === "lime" ? "bg-tint-cream dark:bg-amber-500/10" : "bg-tint-blue dark:bg-plum-900/40")}>
                    <p class="flex items-center gap-2 text-[14.5px] font-semibold">
                      <Megaphone size={14} class="text-plum-700 dark:text-lime-400 shrink-0" />
                      {a.title}
                    </p>
                    <p class="mt-1.5 text-[13.5px] text-ink-2 leading-relaxed">{a.body}</p>
                    <p class="mt-2 text-[12px] text-muted/80">
                      {a.author} · {fmtRelative(a.createdAt)}
                    </p>
                  </article>
                )}
              </For>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row(props) {
  return (
    <div class="flex items-center justify-between gap-3">
      <dt class="flex items-center gap-2 text-muted">
        {props.icon}
        {props.label}
      </dt>
      <dd class="font-semibold text-right truncate">{props.value}</dd>
    </div>
  );
}

function Hero(props) {
  const mod = () => props.mod;
  const due = () => daysUntil(mod().dueAt);
  const cta = () => {
    switch (mod().stage) {
      case "learn": {
        const next = mod().materials.find((m) => m.required && !m.progress.completed);
        return { label: next?.progress.opened ? "Continue training" : "Start training", href: next ? `/training/${next.id}` : "/training", icon: BookOpen };
      }
      case "assess":
        return mod().eligible
          ? { label: "Take your test", href: "/test", icon: Play }
          : { label: "View test details", href: "/test", icon: BookOpen };
      case "done":
        return { label: "See your results", href: "/scoreboard", icon: Trophy };
      default:
        return { label: "Browse company materials", href: "/training", icon: BookOpen };
    }
  };
  const headline = () =>
    ({ learn: "Keep going.", assess: mod().eligible ? "You're ready." : "Training complete.", done: "Well done.", unassigned: "Welcome." })[mod().stage];
  const message = () =>
    ({
      learn: `${mod().completedRequired} of ${mod().requiredCount} required modules done. Finish them to unlock your test.`,
      assess: mod().eligible ? "Training complete. Your test is ready when you are." : "Training complete, but you have no attempts left. Please contact your training admin.",
      done: `You've passed your ${mod().department?.name} test. Your modules stay here for reference.`,
      unassigned: "There's no training module mapped to your designation yet. Company-wide materials are still available to you.",
    })[mod().stage];

  return (
    <section class="hero-wash -mt-4 sm:-mt-8 mx-[calc(50%-50vw)] px-4 sm:px-6 pt-12 pb-16 sm:pt-28 sm:pb-24 text-center">
      {/* Full-bleed: breaks out of the page container to the window edges. */}
      <div class="hero-ellipses" aria-hidden="true"><span /><span /><span /></div>
      <div class="mx-auto max-w-[900px] stagger">
        <p class="inline-flex items-center gap-2 h-8 px-3.5 rounded-full border border-plum-200 bg-white/70 dark:bg-surface dark:border-line text-[13px] font-medium text-plum-700 dark:text-lime-400">
          <Sparkles size={13} /> {greeting()}
          <span class="hidden sm:inline text-ink-2"> · {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
        </p>
        <h1 class="mt-5 text-[32px] sm:text-[48px] leading-[1.2] font-bold tracking-[-0.02em]">Welcome back, {props.firstName}</h1>
        <p class="mt-4 mx-auto max-w-[720px] text-[16px] sm:text-[18px] leading-relaxed text-ink-2">
          <span class="font-semibold text-plum-700 dark:text-lime-400">{headline()}</span> {message()}
        </p>
        <div class="mt-5 flex flex-wrap justify-center gap-2">
          <Show when={props.me.department}>
            <span class="badge badge-outline px-3 py-1.5 text-[13px]">
              <DeptIcon id={props.me.department.id} size={13} class="text-plum-700 dark:text-lime-400" /> {props.me.department.name}
            </span>
          </Show>
          <span class="badge badge-outline px-3 py-1.5 text-[13px]">
            <UserRound size={13} class="text-plum-700 dark:text-lime-400" /> {props.me.designation?.title ?? "No designation"}
          </span>
          <span class="hidden sm:inline-flex badge badge-outline !text-muted px-3 py-1.5 text-[13px]" title="Set by your organisation">
            <Lock size={12} /> Assigned by HR
          </span>
        </div>
        <Show when={mod().department && mod().stage !== "done"}>
          <div class="sm:hidden mt-5 text-left">
            <div class="flex justify-between text-[13px] text-ink-2 mb-1.5">
              <span>Training progress</span>
              <span class="tabular font-semibold text-ink">{props.readPct}%</span>
            </div>
            <ProgressBar value={props.readPct} tone="plum" />
          </div>
        </Show>
        <div class="mt-7 flex flex-col items-center gap-3">
          <button class="btn-pill w-full sm:w-auto justify-between" onClick={() => navigate(cta().href)}>
            {cta().label}
            <span class="btn-pill-arrow">
              <ArrowUpRight size={18} />
            </span>
          </button>
          <Show when={mod().department && mod().stage !== "done"}>
            <span class={cx("inline-flex items-center gap-2 text-[14px]", due() <= 3 ? "text-crimson-600 dark:text-crimson-300" : "text-ink-2")}>
              <CalendarClock size={16} />
              {due() >= 0 ? `Due ${fmtDate(mod().dueAt)} · ${plural(due(), "day")} left` : `Overdue since ${fmtDate(mod().dueAt)}`}
            </span>
          </Show>
        </div>
      </div>
      {/* Sits on the fading edge of the glow, like the hack2skill logo strip. */}
      <Show when={mod().department}>
        <StatsBand mod={mod()} readPct={props.readPct} />
      </Show>
    </section>
  );
}

// Numbers strip at the foot of the hero.
function StatsBand(props) {
  const mod = () => props.mod;
  const items = () => [
    { value: `${mod().stage === "done" ? 100 : props.readPct}%`, label: "Training complete" },
    { value: `${mod().completedTotal}/${mod().materials.length}`, label: "Materials done" },
    { value: mod().best ? `${Math.round(mod().best.percentage)}%` : "—", label: "Best score" },
    { value: mod().assessment ? `${mod().assessment.attemptsLeft}/${mod().assessment.maxAttempts}` : "—", label: "Attempts left" },
  ];
  return (
    <div class="band-blue mt-12 sm:mt-20 mx-auto max-w-[1192px] rounded-[20px] px-4 py-6 sm:px-8 sm:py-8">
      <dl class="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4 text-center">
        <For each={items()}>
          {(it) => (
            <div class="flex flex-col-reverse">
              <dt class="mt-2 text-[14px] sm:text-[15px] font-medium text-ink">{it.label}</dt>
              <dd class="text-[30px] sm:text-[40px] leading-none font-bold tracking-[-0.02em] text-plum-700 dark:text-lime-400 tabular">{it.value}</dd>
            </div>
          )}
        </For>
      </dl>
    </div>
  );
}

// Training → Test → Result → Certified, as a progress strip (a list on phones).
function Journey(props) {
  const mod = () => props.mod;
  const steps = () => {
    const stage = mod().stage;
    const read = mod().completedRequired === mod().requiredCount;
    const attempted = !!mod().lastAttempt;
    return [
      { label: "Finish your training", sub: `${mod().completedRequired} of ${mod().requiredCount} required done`, state: read ? "done" : "current", href: "/training" },
      {
        label: "Take your test",
        sub: mod().assessment.attemptsUsed ? `${mod().assessment.attemptsUsed} attempt${mod().assessment.attemptsUsed > 1 ? "s" : ""} used` : `${mod().assessment.durationMinutes} min · ${mod().assessment.questionCount} Qs`,
        state: stage === "done" ? "done" : read ? "current" : "locked",
        href: "/test",
      },
      {
        label: "See your result",
        sub: attempted ? `Last score ${Math.round(mod().lastAttempt.percentage)}%` : "Right after you submit",
        state: attempted ? "done" : "locked",
        href: "/scoreboard",
      },
      { label: "Get certified", sub: `Score ${mod().assessment.passPercent}% or more`, state: stage === "done" ? "done" : "locked", href: "/scoreboard" },
    ];
  };
  const TINTS = [
    { bg: "bg-tint-blue", icon: "text-[#3463AF]", Icon: BookOpen },
    { bg: "bg-tint-cream", icon: "text-[#D97706]", Icon: ListChecks },
    { bg: "bg-tint-mint", icon: "text-[#0F766E]", Icon: Target },
    { bg: "bg-tint-lavender", icon: "text-[#6D28D9]", Icon: Trophy },
  ];
  return (
    <section>
      <h2 class="text-[22px] sm:text-[28px] font-bold leading-tight">Your path to certification</h2>
      <p class="mt-1 text-[15px] text-ink-2">Four steps, in order. Each one unlocks the next.</p>
      <ol class="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <For each={steps()}>
          {(s, i) => (
            <li>
              <Link
                href={s.href}
                class={cx(
                  "flex sm:flex-col gap-4 h-full p-5 sm:p-6 rounded-[20px] transition dark:!bg-surface dark:border dark:border-line",
                  TINTS[i()].bg,
                  s.state === "current" ? "ring-2 ring-plum-700 dark:ring-lime-400" : "hover:ring-1 hover:ring-line-strong",
                )}
              >
                <span class={cx("grid place-items-center shrink-0 w-12 h-12 rounded-full bg-white dark:bg-sunken", TINTS[i()].icon)}>
                  <Dynamic component={TINTS[i()].Icon} size={22} />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-[13px] font-medium text-ink-2">Step {i() + 1}</span>
                  <span class={cx("block mt-0.5 text-[17px] font-semibold leading-snug", s.state === "locked" && "text-ink-2")}>{s.label}</span>
                  <span class="block mt-1 text-[14px] text-ink-2">{s.sub}</span>
                  <span
                    class={cx(
                      "inline-flex items-center gap-1.5 mt-3 text-[13px] font-semibold",
                      s.state === "done" && "text-emerald-700 dark:text-emerald-300",
                      s.state === "current" && "text-plum-700 dark:text-lime-400",
                      s.state === "locked" && "text-muted",
                    )}
                  >
                    <Switch>
                      <Match when={s.state === "done"}>
                        <CircleCheck size={15} /> Done
                      </Match>
                      <Match when={s.state === "current"}>
                        <ArrowRight size={15} /> Up next
                      </Match>
                      <Match when={s.state === "locked"}>
                        <Lock size={13} /> Locked
                      </Match>
                    </Switch>
                  </span>
                </span>
              </Link>
            </li>
          )}
        </For>
      </ol>
      <Show when={!mod().eligible && mod().stage === "assess"}>
        <p class="flex items-center gap-2 mt-3 px-4 py-3 rounded-xl text-[14px] font-medium badge-warn">
          <TriangleAlert size={15} /> No attempts left. Ask your training admin to reset your attempts.
        </p>
      </Show>
    </section>
  );
}
