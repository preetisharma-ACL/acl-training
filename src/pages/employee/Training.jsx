// Training module: every material assigned to the employee (their
// department's plus company-wide), with progress, and the assessment panel
// that unlocks once the backend says the conditions are met.

import { batch, createResource, createSignal, For, Show } from "solid-js";
import {
  ArrowRight,
  Download,
  Clock,
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
  Send,
  ShieldCheck,
  Trophy,
  BookOpen,
  Info,
} from "lucide-solid";
import { Link, navigate } from "../../lib/router";
import { cx } from "../../lib/format";
import { user } from "../../store/auth";
import { toast } from "../../store/toast";
import { beginSession } from "../../store/assessment";
import { getMyModule, getMaterial, getMaterialFile, startAttempt } from "../../services/training";
import { PageHeader, ProgressBar, Skeleton, Modal, EmptyState } from "../../components/ui";
import { DeptIcon, TypeIcon, MATERIAL_TYPES } from "../../components/icons";

export async function downloadMaterial(me, id) {
  try {
    const m = await getMaterial(me, id);
    const f = await getMaterialFile(m);
    const a = document.createElement("a");
    a.href = f.url;
    a.download = f.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(`${f.fileName} is downloading.`, { title: "Download started" });
  } catch (e) {
    toast(e.message, { tone: "error" });
  }
}

export default function Training() {
  const me = user();
  const [mod] = createResource(() => getMyModule(me));

  return (
    <div class="grid gap-7">
      <PageHeader
        kicker={
          <>
            <Show when={me.department} fallback={<BookOpen size={13} />}>
              <DeptIcon id={me.department.id} size={13} />
            </Show>{" "}
            {me.department?.name ?? "Company-wide"} · {me.designation?.title}
          </>
        }
        title="Your training module"
        subtitle="Preview each required module to complete it. The assessment unlocks once they're all done."
      />

      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <section class="card overflow-hidden">
          <header class="px-5 sm:px-6 py-5 border-b border-line">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-[16px] font-semibold">Modules</h2>
              <Show when={mod()}>
                <span class="text-[12.5px] text-muted">
                  <strong class="text-ink tabular">{mod().completedRequired}</strong> of <strong class="text-ink tabular">{mod().requiredCount}</strong> required complete
                </span>
              </Show>
            </div>
            <Show when={mod()}>
              <ProgressBar value={mod().requiredCount ? (mod().completedRequired / mod().requiredCount) * 100 : 0} class="mt-3" />
            </Show>
          </header>

          <Show
            when={mod()}
            fallback={
              <div class="p-5 grid gap-3">
                <For each={[1, 2, 3, 4]}>{() => <Skeleton class="h-14" />}</For>
              </div>
            }
          >
            <Show
              when={mod().materials.length}
              fallback={
                <EmptyState icon={<BookOpen size={24} />} title="No documents yet">
                  Your training documents will appear here once they're assigned.
                </EmptyState>
              }
            >
              <ul class="divide-y divide-line">
                <For each={mod().materials}>{(m) => <DocumentRow m={m} me={me} />}</For>
              </ul>
            </Show>
          </Show>
        </section>

        <aside class="lg:sticky lg:top-[92px]" id="assessment">
          <Show when={mod()} fallback={<Skeleton class="h-[460px] !rounded-[24px]" />}>
            <Show when={mod().department} fallback={<Unassigned me={me} />}>
              <AssessmentPanel mod={mod()} me={me} />
            </Show>
          </Show>
        </aside>
      </div>
    </div>
  );
}

const TYPE_TILE = {
  pdf: "bg-crimson-50 text-crimson-600 dark:bg-crimson-500/15 dark:text-crimson-300",
  manual: "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200",
  structured: "bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300",
};

// One document: what it is, whether it's done, and two actions.
function DocumentRow(props) {
  const m = props.m;
  return (
    <li class="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3 px-5 sm:px-6 py-4 hover:bg-sunken/40 transition-colors">
      <span class={cx("grid place-items-center shrink-0 w-11 h-11 rounded-xl", TYPE_TILE[m.type])}>
        <TypeIcon type={m.type} size={19} />
      </span>
      <div class="flex-1 min-w-0 basis-[180px]">
        <p class="flex items-center gap-2 min-w-0">
          <span class="min-w-0 truncate text-[14.5px] font-semibold">{m.title}</span>
          <Show when={m.required}>
            <span class="badge badge-neutral shrink-0">Required</span>
          </Show>
        </p>
        <p class="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted whitespace-nowrap">
          <span>{MATERIAL_TYPES[m.type].short}</span>·<span>{m.estMinutes} min read</span>
          <Show when={m.scope === "company"}>
            ·<span>Company-wide</span>
          </Show>
        </p>
      </div>
      <span class="shrink-0 w-[104px]">
        <Show
          when={m.progress.completed}
          fallback={<span class={cx("badge", m.progress.opened ? "badge-plum" : "badge-outline")}>{m.progress.opened ? "In progress" : "Not started"}</span>}
        >
          <span class="badge badge-success">
            <CircleCheck size={12} /> Completed
          </span>
        </Show>
      </span>
      <div class="flex gap-2 shrink-0 ml-auto">
        <Link href={`/training/${m.id}`} class="btn btn-primary btn-sm">
          <Eye size={14} /> {m.type === "pdf" ? "Preview PDF" : "Preview"}
        </Link>
        <button class="btn btn-secondary btn-sm" onClick={() => downloadMaterial(props.me, m.id)} aria-label={`Download ${m.title}`}>
          <Download size={14} /> {m.type === "pdf" ? "Download PDF" : "Download"}
        </button>
      </div>
    </li>
  );
}

function Unassigned(props) {
  return (
    <section class="card p-6">
      <span class="grid place-items-center w-12 h-12 rounded-2xl badge-warn">
        <Info size={22} />
      </span>
      <h2 class="mt-4 text-[17px] font-semibold">No assessment assigned</h2>
      <p class="mt-2 text-[13.5px] text-muted leading-relaxed">
        Your designation (<strong class="text-ink">{props.me.designation?.title ?? "not set"}</strong>) isn't mapped to a department module yet. You can still read
        the company-wide materials. Please contact HR or your training admin.
      </p>
    </section>
  );
}

function AssessmentPanel(props) {
  const mod = () => props.mod;
  const a = () => mod().assessment;
  const [ack, setAck] = createSignal(false);
  const [rules, setRules] = createSignal(false);
  const [starting, setStarting] = createSignal(false);
  const [error, setError] = createSignal(null);

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
    <section class="relative overflow-hidden rounded-[24px] hero-aurora grain text-white shadow-float">
      <div class="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-lime-400/20 blur-[60px] pointer-events-none" />
      <div class="relative z-[1] p-6">
        <div class="flex items-center justify-between">
          <span class={cx("grid place-items-center w-12 h-12 rounded-2xl", mod().eligible ? "bg-lime-400 text-plum-950 shadow-[0_0_30px_rgba(199,232,72,0.45)]" : "glass text-white/80")}>
            <Show when={mod().eligible} fallback={<Lock size={20} />}>
              <LockOpen size={20} />
            </Show>
          </span>
          <span class={cx("badge px-2.5 py-1", mod().passed ? "bg-lime-400 text-plum-950" : mod().eligible ? "glass text-lime-300" : "glass text-white/70")}>
            {mod().passed ? "Certified" : mod().eligible ? "Unlocked" : "Locked"}
          </span>
        </div>
        <p class="eyebrow-lime mt-5">Assessment</p>
        <h2 class="mt-1.5 text-[21px] font-semibold tracking-[-0.02em]">{mod().department.name}</h2>

        <div class="grid grid-cols-3 gap-2 mt-5">
          <For
            each={[
              [ListChecks, a().questionCount, "Questions"],
              [Timer, `${a().durationMinutes}m`, "Time limit"],
              [Target, `${a().passPercent}%`, "To pass"],
            ]}
          >
            {([Icon, v, l]) => (
              <div class="px-2 py-3 rounded-2xl bg-white/[0.07] border border-white/10 text-center">
                <Icon size={15} class="mx-auto text-lime-300" />
                <p class="mt-1.5 text-[17px] font-semibold tabular leading-none">{v}</p>
                <p class="mt-1 text-[10px] uppercase tracking-[0.1em] text-white/50">{l}</p>
              </div>
            )}
          </For>
        </div>

        <ul class="grid gap-2.5 mt-5">
          <For each={mod().conditions}>
            {(c) => (
              <li class="flex items-start gap-3">
                <span class={cx("grid place-items-center shrink-0 w-6 h-6 rounded-full mt-px", c.met ? "bg-lime-400 text-plum-950" : "bg-white/10 text-white/50")}>
                  <Show when={c.met} fallback={<Circle size={12} />}>
                    <CircleCheck size={14} />
                  </Show>
                </span>
                <span>
                  <span class={cx("block text-[13px] font-medium", c.met ? "text-white" : "text-white/75")}>{c.label}</span>
                  <span class="block text-[11.5px] text-white/50">{c.detail}</span>
                </span>
              </li>
            )}
          </For>
        </ul>

        <Show when={mod().best}>
          <Link href={`/scoreboard/${mod().best.id}`} class="flex items-center gap-3 mt-5 p-3 rounded-2xl bg-white/[0.07] border border-white/10 hover:bg-white/[0.1] transition">
            <Trophy size={17} class="text-lime-300" />
            <span class="text-[13px] flex-1">
              Best score <strong class="tabular">{mod().best.percentage}%</strong>
            </span>
            <ArrowRight size={15} class="text-white/50" />
          </Link>
        </Show>

        <div class="mt-5 pt-5 border-t border-white/10">
          <Show
            when={mod().eligible}
            fallback={
              <p class="text-[12.5px] text-white/60 leading-relaxed">
                {mod().conditions.find((c) => !c.met)?.id === "attempts"
                  ? "You've used all your attempts. Your training admin can grant another."
                  : "Complete every required material to unlock the assessment."}
              </p>
            }
          >
            <label class="flex items-start gap-2.5 text-[13px] text-white/85 cursor-pointer select-none">
              <input type="checkbox" checked={ack()} onChange={(e) => setAck(e.currentTarget.checked)} class="w-4 h-4 mt-0.5 accent-lime-400" />
              I've read and understood the {mod().department.name} training material.
            </label>
            <button class="btn btn-lime btn-lg w-full mt-4" disabled={!ack()} onClick={() => setRules(true)}>
              <Show when={mod().passed || a().attemptsUsed} fallback={<Play size={16} />}>
                <RotateCcw size={16} />
              </Show>
              {a().attemptsUsed ? `Start attempt ${a().attemptsUsed + 1} of ${a().maxAttempts}` : "Start assessment"}
            </button>
            <p class="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-white/50">
              <Lock size={11} /> Training is locked while the test runs
            </p>
          </Show>
        </div>
      </div>

      <Show when={rules()}>
        <Modal onClose={() => !starting() && setRules(false)} labelledBy="rules-title" size="md">
          <div class="grid justify-items-center gap-4 text-center">
            <span class="grid place-items-center w-14 h-14 rounded-2xl bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-300">
              <ListChecks size={24} />
            </span>
            <div>
              <h2 id="rules-title" class="text-xl font-semibold">Before you begin</h2>
              <p class="mt-1 text-[13px] text-muted">
                Attempt {a().attemptsUsed + 1} of {a().maxAttempts} · {mod().department.name}
              </p>
            </div>
            <div class="grid grid-cols-3 gap-2.5 w-full">
              <For
                each={[
                  [a().questionCount, "Questions"],
                  [`${a().durationMinutes} min`, "Time limit"],
                  [`${a().passPercent}%`, "To pass"],
                ]}
              >
                {([v, l]) => (
                  <div class="py-3 rounded-2xl bg-sunken/70 border border-line">
                    <p class="text-lg font-semibold tabular">{v}</p>
                    <p class="text-xs text-muted">{l}</p>
                  </div>
                )}
              </For>
            </div>
            <ul class="grid gap-3 w-full text-left">
              <For
                each={[
                  [Lock, "The training module is locked once the test starts."],
                  [Eye, "Switching tabs, minimising or leaving the window pauses the test and is recorded."],
                  [Clock, "Your answers and remaining time are saved — you can resume where you stopped."],
                  [Send, "The test submits automatically when the timer reaches zero."],
                  [ShieldCheck, "Four options per question; one is correct. Unanswered questions score zero."],
                ]}
              >
                {([Icon, text]) => (
                  <li class="flex items-start gap-3 text-[13.5px] text-ink-2">
                    <Icon size={16} class="shrink-0 mt-0.5 text-plum-600 dark:text-lime-300" /> {text}
                  </li>
                )}
              </For>
            </ul>
            <Show when={error()}>
              <p class="error-text">{error()}</p>
            </Show>
            <div class="grid grid-cols-2 gap-2.5 w-full mt-1">
              <button class="btn btn-secondary" disabled={starting()} onClick={() => setRules(false)}>
                Not yet
              </button>
              <button class="btn btn-primary" disabled={starting()} onClick={begin}>
                <Play size={15} /> {starting() ? "Starting…" : "Begin assessment"}
              </button>
            </div>
          </div>
        </Modal>
      </Show>
    </section>
  );
}
