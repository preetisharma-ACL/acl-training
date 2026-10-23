// Admin · Assessments: rules for each department's test, and a way into its
// question bank.

import { createResource, createSignal, For, Show } from "solid-js";
import { Settings2, ListChecks, Timer, Target, RotateCcw, Shuffle, ArrowRight, TriangleAlert } from "lucide-solid";
import { navigate } from "../../lib/router";
import { cx } from "../../lib/format";
import { toast } from "../../store/toast";
import { listAssessments, saveAssessmentSettings } from "../../services/admin";
import { PageHeader, Skeleton, Modal, Field, Toggle } from "../../components/ui";
import { DeptIcon } from "../../components/icons";

export default function Assessments() {
  const [list, { refetch }] = createResource(listAssessments);
  const [editing, setEditing] = createSignal(null);

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="Learning"
        title="Assessments"
        subtitle="Timed multiple-choice tests, four options per question. Leaving the window pauses the test and is recorded; it auto-submits when time runs out."
      />

      <Show when={list()} fallback={<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><For each={[1, 2, 3, 4]}>{() => <Skeleton class="h-[230px] !rounded-2xl" />}</For></div>}>
        <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 stagger">
          <For each={list()}>
            {(a) => (
              <article class="card card-hover p-5 flex flex-col">
                <div class="flex items-start gap-3.5">
                  <span class="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-plum-600 to-plum-900 text-lime-300">
                    <DeptIcon id={a.id} size={20} />
                  </span>
                  <div class="min-w-0 flex-1">
                    <h2 class="text-[16px] font-semibold truncate">{a.name}</h2>
                    <p class="text-[12px] text-muted">
                      {a.attempts} attempt{a.attempts === 1 ? "" : "s"} taken
                      <Show when={a.avgScore != null}>
                        {" "}· avg {a.avgScore}% · {a.passRate}% pass rate
                      </Show>
                    </p>
                  </div>
                  <Show when={!a.questions}>
                    <span class="badge badge-warn">
                      <TriangleAlert size={11} /> No questions
                    </span>
                  </Show>
                </div>
                <div class="grid grid-cols-4 gap-2 mt-5">
                  <For
                    each={[
                      [ListChecks, a.questions, "Questions"],
                      [Timer, `${a.durationMinutes}m`, "Time"],
                      [Target, `${a.passPercent}%`, "Pass"],
                      [RotateCcw, a.maxAttempts, "Attempts"],
                    ]}
                  >
                    {([Icon, v, l]) => (
                      <div class="py-2.5 rounded-xl bg-sunken/60 text-center">
                        <Icon size={14} class="mx-auto text-muted" />
                        <p class="mt-1 text-[15px] font-semibold tabular">{v}</p>
                        <p class="text-[10.5px] uppercase tracking-[0.08em] text-muted">{l}</p>
                      </div>
                    )}
                  </For>
                </div>
                <Show when={a.passRate != null}>
                  <div class="mt-4">
                    <div class="flex justify-between text-[11.5px] text-muted mb-1.5">
                      <span>Pass rate</span>
                      <span class="tabular">{a.passRate}%</span>
                    </div>
                    <div class="h-1.5 rounded-full bg-sunken overflow-hidden">
                      <div class="h-full rounded-full bg-gradient-to-r from-plum-400 to-plum-600 dark:from-lime-500 dark:to-lime-300" style={{ width: `${a.passRate}%` }} />
                    </div>
                  </div>
                </Show>
                <div class="flex gap-2 mt-auto pt-5">
                  <button class="btn btn-secondary btn-sm flex-1" onClick={() => setEditing(a)}>
                    <Settings2 size={14} /> Settings
                  </button>
                  <button class="btn btn-primary btn-sm flex-1" onClick={() => navigate(`/admin/assessments/${a.id}`)}>
                    Question bank <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>

      <Show when={editing()}>
        <SettingsModal
          a={editing()}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      </Show>
    </div>
  );
}

export function SettingsModal(props) {
  const [f, setF] = createSignal({
    durationMinutes: props.a.durationMinutes,
    passPercent: props.a.passPercent,
    marksPerQuestion: props.a.marksPerQuestion,
    maxAttempts: props.a.maxAttempts,
    shuffle: props.a.shuffle,
  });
  const set = (k) => (v) => setF({ ...f(), [k]: v });
  const [busy, setBusy] = createSignal(false);
  const valid = () =>
    f().durationMinutes >= 1 && f().durationMinutes <= 180 && f().passPercent >= 1 && f().passPercent <= 100 && f().maxAttempts >= 1 && f().marksPerQuestion >= 1;

  const save = async () => {
    setBusy(true);
    await saveAssessmentSettings(props.a.id, f());
    toast(`${props.a.name} assessment settings saved. New attempts use them.`);
    props.onSaved();
  };

  const num = (k, label, suffix, min, max, hint) => (
    <Field label={label} for={`s-${k}`} hint={hint}>
      <div class="relative">
        <input
          id={`s-${k}`}
          type="number"
          min={min}
          max={max}
          class="input pr-14"
          value={f()[k]}
          onInput={(e) => set(k)(Number(e.currentTarget.value))}
        />
        <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">{suffix}</span>
      </div>
    </Field>
  );

  return (
    <Modal
      title={`${props.a.name} assessment`}
      subtitle="Changes apply to new attempts. Tests already in progress keep their original rules."
      labelledBy="settings-title"
      onClose={() => !busy() && props.onClose()}
      footer={
        <>
          <button class="btn btn-secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={save} disabled={!valid() || busy()}>
            {busy() ? "Saving…" : "Save settings"}
          </button>
        </>
      }
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {num("durationMinutes", "Time limit", "min", 1, 180, "Auto-submits at 00:00.")}
        {num("passPercent", "Pass mark", "%", 1, 100)}
        {num("marksPerQuestion", "Marks per question", "marks", 1, 10)}
        {num("maxAttempts", "Attempts allowed", "tries", 1, 10, "Per employee.")}
      </div>
      <div class={cx("flex items-center justify-between gap-4 p-4 mt-4 rounded-2xl border border-line")}>
        <div class="flex items-start gap-3">
          <Shuffle size={17} class="mt-0.5 text-muted" />
          <div>
            <p class="text-[13.5px] font-semibold">Shuffle questions and options</p>
            <p class="text-[12px] text-muted">Every attempt gets its own order.</p>
          </div>
        </div>
        <Toggle checked={f().shuffle} onChange={set("shuffle")} label="Shuffle" />
      </div>
    </Modal>
  );
}
