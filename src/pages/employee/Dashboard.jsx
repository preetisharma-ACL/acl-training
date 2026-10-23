// Personalised dashboard. Everything here is driven by what the backend
// returns for the signed-in user (department and designation included) —
// the employee never chooses either.

import { createResource, For, Show, Switch, Match } from "solid-js";
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
    <div class="grid gap-6 sm:gap-7">
      <Show when={mod()} fallback={<Skeleton class="h-[300px] !rounded-[28px]" />}>
        <Hero me={me} mod={mod()} readPct={readPct()} firstName={firstName} />
      </Show>

      <Show when={mod()?.department}>
        <Journey mod={mod()} />
      </Show>

      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div class="grid grid-cols-1 gap-6 min-w-0">
          <section class="card p-5 sm:p-6">
            <SectionTitle
              title="Your training module"
              subtitle={mod() ? `${plural(mod().materials.length, "material")} · ${mod().readingMinutesLeft} min of reading left` : "Loading…"}
              action={
                <Link href="/training" class="btn btn-secondary btn-sm">
                  Open module <ArrowRight size={14} />
                </Link>
              }
            />
            <Show when={mod()} fallback={<div class="grid gap-3 mt-5"><Skeleton class="h-16" /><Skeleton class="h-16" /><Skeleton class="h-16" /></div>}>
              <ul class="mt-5 grid gap-2.5 stagger">
                <For each={mod().materials.slice(0, 5)}>
                  {(m) => (
                    <li>
                      <Link
                        href={`/training/${m.id}`}
                        class="group flex items-center gap-4 p-3.5 rounded-2xl border border-line bg-surface hover:border-line-strong hover:shadow-card hover:-translate-y-px transition"
                      >
                        <span
                          class={cx(
                            "grid place-items-center shrink-0 w-11 h-11 rounded-xl transition",
                            m.progress.completed
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200 group-hover:bg-plum-700 group-hover:text-white dark:group-hover:bg-lime-400 dark:group-hover:text-plum-950",
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

          <section class="card p-5 sm:p-6">
            <SectionTitle
              title="Recent results"
              subtitle="Your assessment history"
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
                    Finish your required materials, then take the assessment — your score will appear here.
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
                            <span class="block font-semibold text-[15px] truncate">{a.departmentName} assessment</span>
                            <span class="block text-[13px] text-muted">
                              {fmtDate(a.submittedAt)} · {a.marks}/{a.totalMarks} marks
                            </span>
                          </span>
                          <span class={cx("badge", a.passed ? "badge-success" : "badge-danger")}>{a.passed ? "Passed" : "Not passed"}</span>
                          <ArrowRight size={16} class="text-muted group-hover:text-ink transition" />
                        </Link>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </section>
        </div>

        <aside class="grid gap-6">
          <div class="grid grid-cols-2 gap-3">
            <MiniStat icon={<BookOpen size={17} />} tone="plum" label="Materials done" value={mod() ? `${mod().completedTotal}/${mod().materials.length}` : "—"} />
            <MiniStat
              icon={<Trophy size={17} />}
              tone="lime"
              label="Best score"
              value={mod()?.best ? <CountUp value={mod().best.percentage} suffix="%" /> : "—"}
            />
            <MiniStat icon={<Target size={17} />} tone="plum" label="Attempts left" value={mod()?.assessment ? `${mod().assessment.attemptsLeft}/${mod().assessment.maxAttempts}` : "—"} />
            <MiniStat icon={<Clock size={17} />} tone="lime" label="Reading left" value={mod() ? `${mod().readingMinutesLeft}m` : "—"} />
          </div>

          <Show when={mod()?.department}>
            <section class="card overflow-hidden">
              <div class="relative px-5 py-5 hero-aurora-soft grain text-white">
                <div class="relative z-[1] flex items-center gap-3.5">
                  <span class="grid place-items-center w-12 h-12 rounded-2xl glass">
                    <DeptIcon id={mod().department.id} size={22} class="text-lime-300" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-[12px] uppercase tracking-[0.16em] text-white/55 font-semibold">Your department</p>
                    <p class="text-[16px] font-semibold truncate">{mod().department.name}</p>
                  </div>
                </div>
              </div>
              <dl class="grid gap-3 p-5 text-[14px]">
                <Row icon={<UserRound size={15} />} label="Department head" value={mod().department.head} />
                <Row icon={<MapPin size={15} />} label="Location" value={mod().department.location} />
                <Row icon={<ListChecks size={15} />} label="Assessment" value={`${mod().assessment.questionCount} questions`} />
                <Row icon={<Timer size={15} />} label="Time limit" value={`${mod().assessment.durationMinutes} minutes`} />
                <Row icon={<Target size={15} />} label="Pass mark" value={`${mod().assessment.passPercent}%`} />
              </dl>
            </section>
          </Show>

          <section class="card p-5">
            <SectionTitle title="Announcements" />
            <div class="mt-4 grid gap-3">
              <For each={news()} fallback={<Skeleton class="h-20" />}>
                {(a) => (
                  <article class="relative p-4 rounded-2xl bg-sunken/60 border border-line/70">
                    <span class={cx("absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full", a.tone === "lime" ? "bg-lime-400" : "bg-plum-500")} />
                    <p class="flex items-center gap-2 text-[14.5px] font-semibold">
                      <Megaphone size={14} class="text-plum-500 dark:text-lime-300 shrink-0" />
                      {a.title}
                    </p>
                    <p class="mt-1.5 text-[13.5px] text-muted leading-relaxed">{a.body}</p>
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

function MiniStat(props) {
  return (
    <div class="card p-4">
      <IconTile tone={props.tone} size="sm">
        {props.icon}
      </IconTile>
      <p class="mt-3 text-[22px] leading-none font-semibold tracking-[-0.02em] tabular">{props.value}</p>
      <p class="mt-1.5 text-[12.5px] font-medium text-muted">{props.label}</p>
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
        return { label: next?.progress.opened ? "Continue reading" : "Start training", href: next ? `/training/${next.id}` : "/training", icon: BookOpen };
      }
      case "assess":
        return mod().eligible
          ? { label: "Take the assessment", href: "/training#assessment", icon: Play }
          : { label: "View your module", href: "/training", icon: BookOpen };
      case "done":
        return { label: "View scoreboard", href: "/scoreboard", icon: Trophy };
      default:
        return { label: "Browse company materials", href: "/training", icon: BookOpen };
    }
  };
  const message = () =>
    ({
      learn: `You've completed ${mod().completedRequired} of ${mod().requiredCount} required materials. Finish them to unlock your assessment.`,
      assess: mod().eligible
        ? "Your reading is complete — the assessment is unlocked and ready when you are."
        : "Your reading is complete, but you have no attempts left. Please contact your training admin.",
      done: `You're certified for ${mod().department?.name}. Keep your materials handy — they're always here for reference.`,
      unassigned: "There's no training module mapped to your designation yet. Company-wide materials are still available to you.",
    })[mod().stage];

  return (
    <section class="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-white via-plum-50 to-lime-50 dark:from-surface dark:via-plum-900/30 dark:to-surface">
      <div class="relative z-[1] grid lg:grid-cols-[minmax(0,1fr)_auto] gap-8 items-center p-6 sm:p-8 lg:px-10 lg:py-8">
        <div class="min-w-0 stagger">
          <p class="kicker">
            <Sparkles size={13} /> {greeting()} · {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 class="mt-3 text-[32px] sm:text-[42px] leading-[1.05] font-semibold tracking-[-0.035em]">
            Welcome back, <span class="text-plum-700 dark:text-lime-300">{props.firstName}.</span>
          </h1>
          <div class="mt-4 flex flex-wrap gap-2">
            <Show when={props.me.department}>
              <span class="badge badge-outline px-3 py-1.5 text-[13px]">
                <DeptIcon id={props.me.department.id} size={13} class="text-plum-600 dark:text-lime-300" /> {props.me.department.name}
              </span>
            </Show>
            <span class="badge badge-outline px-3 py-1.5 text-[13px]">
              <UserRound size={13} class="text-plum-600 dark:text-lime-300" /> {props.me.designation?.title ?? "No designation"}
            </span>
            <span class="badge badge-outline !text-muted px-3 py-1.5 text-[13px]" title="Set by your organisation">
              <Lock size={12} /> Assigned by HR
            </span>
          </div>
          <p class="mt-4 max-w-[560px] text-[16px] leading-relaxed text-ink-2">{message()}</p>
          <div class="mt-5 flex flex-wrap items-center gap-3">
            <button class="btn btn-primary btn-lg !shadow-none" onClick={() => navigate(cta().href.split("#")[0])}>
              {cta().label} <ArrowRight size={17} />
            </button>
            <Show when={mod().department && mod().stage !== "done"}>
              <span class={cx("inline-flex items-center gap-2 text-[14px]", due() <= 3 ? "text-crimson-600 dark:text-crimson-300" : "text-muted")}>
                <CalendarClock size={16} />
                {due() >= 0 ? `Due ${fmtDate(mod().dueAt)} · ${plural(due(), "day")} left` : `Overdue since ${fmtDate(mod().dueAt)}`}
              </span>
            </Show>
          </div>
        </div>

        <Show when={mod().department}>
          <div class="hidden sm:flex items-center gap-6 lg:flex-col lg:gap-4 p-5 rounded-3xl bg-surface/80 border border-line">
            <ProgressRing value={mod().stage === "done" ? 100 : props.readPct} size={140} stroke={11} trackClass="stroke-sunken">
              <span class="text-[32px] leading-none font-semibold tracking-[-0.03em]">
                <CountUp value={mod().stage === "done" ? 100 : props.readPct} suffix="%" />
              </span>
              <span class="mt-1.5 text-[12px] uppercase tracking-[0.14em] text-muted">{mod().stage === "done" ? "Certified" : "Module read"}</span>
            </ProgressRing>
            <div class="grid grid-cols-2 gap-2 lg:w-full text-center">
              <div class="px-3 py-2.5 rounded-2xl bg-sunken/70">
                <p class="text-[18px] font-semibold tabular">
                  {mod().completedRequired}/{mod().requiredCount}
                </p>
                <p class="text-[11.5px] uppercase tracking-[0.1em] text-muted">Required</p>
              </div>
              <div class="px-3 py-2.5 rounded-2xl bg-sunken/70">
                <p class="text-[18px] font-semibold tabular">{mod().best ? `${Math.round(mod().best.percentage)}%` : "—"}</p>
                <p class="text-[11.5px] uppercase tracking-[0.1em] text-muted">Best</p>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </section>
  );
}

// Login → Dashboard → Training → Assessment → Scoreboard, as a progress strip.
function Journey(props) {
  const mod = () => props.mod;
  const steps = () => {
    const stage = mod().stage;
    const read = mod().completedRequired === mod().requiredCount;
    const attempted = !!mod().lastAttempt;
    return [
      { label: "Read materials", sub: `${mod().completedRequired}/${mod().requiredCount} required`, state: read ? "done" : "current", href: "/training" },
      {
        label: "Take assessment",
        sub: mod().assessment.attemptsUsed ? `${mod().assessment.attemptsUsed} attempt${mod().assessment.attemptsUsed > 1 ? "s" : ""} used` : `${mod().assessment.durationMinutes} min · ${mod().assessment.questionCount} Qs`,
        state: stage === "done" ? "done" : read ? "current" : "locked",
        href: "/training",
      },
      {
        label: "Review scoreboard",
        sub: attempted ? `Last: ${Math.round(mod().lastAttempt.percentage)}%` : "After you submit",
        state: attempted ? "done" : "locked",
        href: "/scoreboard",
      },
      { label: "Get certified", sub: `Pass mark ${mod().assessment.passPercent}%`, state: stage === "done" ? "done" : "locked", href: "/scoreboard" },
    ];
  };
  return (
    <section class="card p-2 sm:p-2.5">
      <ol class="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
        <For each={steps()}>
          {(s, i) => (
            <li>
              <Link
                href={s.href}
                class={cx(
                  "flex items-center gap-3 h-full p-3 sm:p-3.5 rounded-[14px] transition",
                  s.state === "current" ? "bg-plum-50 dark:bg-lime-400/10" : "hover:bg-sunken/60",
                )}
              >
                <span
                  class={cx(
                    "grid place-items-center shrink-0 w-9 h-9 rounded-full text-[14px] font-semibold",
                    s.state === "done" && "bg-lime-400 text-plum-950",
                    s.state === "current" && "bg-plum-700 text-white dark:bg-lime-400 dark:text-plum-950 shadow-[0_0_0_4px_rgba(84,44,95,0.12)]",
                    s.state === "locked" && "bg-sunken text-muted",
                  )}
                >
                  <Switch fallback={i() + 1}>
                    <Match when={s.state === "done"}>
                      <Check size={16} stroke-width={3} />
                    </Match>
                    <Match when={s.state === "locked"}>
                      <Lock size={14} />
                    </Match>
                  </Switch>
                </span>
                <span class="min-w-0">
                  <span class={cx("block text-[14px] font-semibold truncate", s.state === "locked" && "text-muted")}>{s.label}</span>
                  <span class="block text-[12.5px] text-muted truncate">{s.sub}</span>
                </span>
              </Link>
            </li>
          )}
        </For>
      </ol>
      <Show when={!mod().eligible && mod().stage === "assess"}>
        <p class="flex items-center gap-2 mx-2 mb-1.5 mt-1 px-3 py-2 rounded-xl text-[13.5px] font-medium badge-warn">
          <TriangleAlert size={14} /> No attempts left — ask your training admin to reset your attempts.
        </p>
      </Show>
    </section>
  );
}
