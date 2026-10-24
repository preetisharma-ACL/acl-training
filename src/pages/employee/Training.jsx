// Training: every module assigned to the employee (their department and
// level, plus company-wide), with progress. A banner at the top shows where
// they stand and sends them to the Test tab once they're ready.

import { createResource, For, Show } from "solid-js";
import { ArrowRight, Download, ExternalLink, Lock, LockOpen, CircleCheck, Play, Eye, BookOpen, Trophy } from "lucide-solid";
import { Link, navigate } from "../../lib/router";
import { cx } from "../../lib/format";
import { user } from "../../store/auth";
import { toast } from "../../store/toast";
import { getMyModule, getMaterial, getMaterialFile } from "../../services/training";
import { ProgressBar, Skeleton, EmptyState } from "../../components/ui";
import { TypeIcon, MATERIAL_TYPES } from "../../components/icons";

export async function downloadMaterial(me, id) {
  try {
    const m = await getMaterial(me, id);
    if (m.type === "media") {
      window.open(m.content?.url, "_blank", "noopener");
      return;
    }
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
  const left = () => (mod() ? mod().requiredCount - mod().completedRequired : 0);

  return (
    <div class="grid gap-5 max-w-[960px] mx-auto">
      <div class="hidden md:block">
        <p class="kicker mb-2">Step 1 of 3</p>
        <h1 class="text-[28px] font-semibold tracking-[-0.025em]">Your training</h1>
        <p class="mt-1.5 text-[15px] text-muted">Open each required module. Your test unlocks when they're all complete.</p>
      </div>

      <Show when={mod()} fallback={<Skeleton class="h-[96px] !rounded-2xl" />}>
        <StatusBanner mod={mod()} left={left()} />
      </Show>

      <section class="card overflow-hidden">
        <header class="px-4 sm:px-6 py-4 border-b border-line">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-[16px] font-semibold">Modules</h2>
            <Show when={mod()}>
              <span class="text-[14px] text-muted tabular">
                {mod().completedRequired}/{mod().requiredCount} required done
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
              <For each={[1, 2, 3]}>{() => <Skeleton class="h-16" />}</For>
            </div>
          }
        >
          <Show
            when={mod().materials.length}
            fallback={
              <EmptyState icon={<BookOpen size={24} />} title="No modules yet">
                Your training modules will appear here once they're assigned.
              </EmptyState>
            }
          >
            <ul class="divide-y divide-line">
              <For each={mod().materials}>{(m) => <ModuleRow m={m} me={me} />}</For>
            </ul>
          </Show>
        </Show>
      </section>
    </div>
  );
}

// Where the employee stands, and the one thing to do next.
function StatusBanner(props) {
  const mod = () => props.mod;
  const state = () => (!mod().department ? "none" : mod().passed ? "passed" : mod().eligible ? "ready" : props.left > 0 ? "reading" : "blocked");
  return (
    <section
      class={cx(
        "flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 rounded-2xl border",
        state() === "ready" ? "bg-lime-50 border-lime-300/70 dark:bg-lime-400/10 dark:border-lime-400/25" : "bg-surface border-line",
      )}
    >
      <div class="flex items-center gap-3.5 flex-1 min-w-0">
        <span
          class={cx(
            "grid place-items-center shrink-0 w-11 h-11 rounded-xl",
            state() === "ready"
              ? "bg-lime-400 text-plum-950"
              : state() === "passed"
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200",
          )}
        >
          {state() === "ready" ? <LockOpen size={20} /> : state() === "passed" ? <Trophy size={20} /> : <Lock size={20} />}
        </span>
        <div class="min-w-0">
          <p class="text-[15.5px] font-semibold">
            {state() === "ready"
              ? "You're ready for your test"
              : state() === "passed"
                ? "You've passed your test"
                : state() === "reading"
                  ? `${props.left} module${props.left === 1 ? "" : "s"} left before your test`
                  : state() === "none"
                    ? "No test assigned yet"
                    : "Your test isn't available right now"}
          </p>
          <p class="text-[13.5px] text-muted">
            {state() === "ready"
              ? `${mod().assessment.questionCount} questions · ${mod().assessment.durationMinutes} min · pass mark ${mod().assessment.passPercent}%`
              : state() === "passed"
                ? "Your modules stay here for reference."
                : state() === "reading"
                  ? "Complete the required modules below to unlock it."
                  : "Open the Test tab for details."}
          </p>
        </div>
      </div>
      <Show when={state() === "ready" || state() === "passed" || state() === "blocked"}>
        <button class={cx("btn w-full sm:w-auto", state() === "ready" ? "btn-primary" : "btn-secondary")} onClick={() => navigate(state() === "passed" ? "/scoreboard" : "/test")}>
          {state() === "ready" ? "Go to test" : state() === "passed" ? "See results" : "View test"} <ArrowRight size={16} />
        </button>
      </Show>
    </section>
  );
}

const TYPE_TILE = {
  pdf: "bg-crimson-50 text-crimson-600 dark:bg-crimson-500/15 dark:text-crimson-300",
  manual: "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200",
  structured: "bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300",
  media: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

// One module: what it is, whether it's done, and two actions.
function ModuleRow(props) {
  const m = props.m;
  const kind = m.type === "media" ? (m.mediaKind === "audio" ? "Audio" : "Video") : MATERIAL_TYPES[m.type].short;
  return (
    <li class="px-4 sm:px-6 py-4 grid gap-3 sm:flex sm:items-center sm:gap-4">
      <div class="flex items-start gap-3.5 flex-1 min-w-0">
        <span class={cx("grid place-items-center shrink-0 w-11 h-11 rounded-xl", TYPE_TILE[m.type])}>
          <TypeIcon type={m.type} size={19} />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[15.5px] font-semibold leading-snug">{m.title}</p>
          <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span>{kind}</span>·<span>{m.estMinutes} min</span>
            <Show when={m.required}>
              ·<span>Required</span>
            </Show>
          </p>
        </div>
        <span class="shrink-0 sm:hidden">
          <Status m={m} />
        </span>
      </div>
      <span class="hidden sm:block shrink-0">
        <Status m={m} />
      </span>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
        <Link href={`/training/${m.id}`} class="btn btn-primary btn-sm h-10 sm:h-9">
          <Show when={m.type === "media"} fallback={<Eye size={15} />}>
            <Play size={15} />
          </Show>
          {m.type === "media" ? "Play" : m.progress.completed ? "Open" : m.progress.opened ? "Continue" : "Start"}
        </Link>
        <button class="btn btn-secondary btn-sm h-10 sm:h-9" onClick={() => downloadMaterial(props.me, m.id)} aria-label={m.type === "media" ? `Open ${m.title}` : `Download ${m.title}`}>
          <Show when={m.type === "media"} fallback={<Download size={15} />}>
            <ExternalLink size={15} />
          </Show>
          {m.type === "media" ? "Open link" : "Download"}
        </button>
      </div>
    </li>
  );
}

function Status(props) {
  return (
    <Show
      when={props.m.progress.completed}
      fallback={<span class={cx("badge", props.m.progress.opened ? "badge-plum" : "badge-outline")}>{props.m.progress.opened ? "In progress" : "Not started"}</span>}
    >
      <span class="badge badge-success">
        <CircleCheck size={12} /> Done
      </span>
    </Show>
  );
}
