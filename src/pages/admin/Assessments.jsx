// Admin · Assessments: every department has three — team heads, seniors and
// juniors — each with its own rules and question bank.

import { createResource, createSignal, createMemo, For, Show } from "solid-js";
import { Settings2, ListChecks, Timer, Target, RotateCcw, Shuffle, ArrowRight, TriangleAlert } from "lucide-solid";
import { navigate, query } from "../../lib/router";
import { LEVELS } from "../../lib/levels";
import { cx } from "../../lib/format";
import { toast } from "../../store/toast";
import { listAssessments, saveAssessmentSettings } from "../../services/admin";
import { PageHeader, Skeleton, Modal, Field, Toggle } from "../../components/ui";
import { DeptIcon } from "../../components/icons";

export default function Assessments() {
  const [list, { refetch }] = createResource(listAssessments);
  const [editing, setEditing] = createSignal(null);
  const [dept, setDept] = createSignal(query().get("dept") || "");
  const departments = createMemo(() => {
    const seen = new Map();
    for (const a of list() ?? []) if (!seen.has(a.departmentId)) seen.set(a.departmentId, a.departmentName);
    return [...seen.entries()];
  });
  const current = () => dept() || departments()[0]?.[0];
  const tracks = () => LEVELS.map((lv) => (list() ?? []).find((a) => a.departmentId === current() && a.level === lv.key)).filter(Boolean);

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="Learning"
        title="Assessments"
        subtitle="Each department has three assessments — team heads, seniors and juniors. Employees automatically get the one for their designation's level."
      />

      <Show when={departments().length}>
        <div class="flex flex-wrap items-center gap-3">
          <label class="text-[14px] font-semibold text-ink-2" for="asm-dept">Department</label>
          <select id="asm-dept" class="input !w-auto min-w-[260px]" value={current()} onChange={(e) => setDept(e.currentTarget.value)}>
            <For each={departments()}>{([id, name]) => <option value={id}>{name}</option>}</For>
          </select>
        </div>
      </Show>

      <Show when={list()} fallback={<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><For each={[1, 2, 3, 4]}>{() => <Skeleton class="h-[230px] !rounded-2xl" />}</For></div>}>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
          <For each={tracks()}>
            {(a) => (
              <article class="card card-hover p-5 flex flex-col">
                <div class="flex items-start gap-3.5">
                  <span class="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-plum-600 to-plum-900 text-lime-300">
                    <DeptIcon id={a.departmentId} size={20} />
                  </span>
                  <div class="min-w-0 flex-1">
                    <h2 class="text-[17px] font-semibold truncate">{a.levelLabel}</h2>
                    <p class="text-[13px] text-muted">
                      {a.employees} employee{a.employees === 1 ? "" : "s"} ·{" "}
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
                <div class="flex flex-wrap gap-1.5 mt-3">
                  <For each={a.designations} fallback={<span class="text-[13px] text-muted">No designations at this level yet</span>}>
                    {(t) => <span class="badge badge-plum">{t}</span>}
                  </For>
                </div>
                <div class="grid grid-cols-4 gap-2 mt-4">
                  <For
                    each={[
                      [ListChecks, `${a.questionsPerAttempt ?? Math.max(1, Math.floor(a.questions / 2) || a.questions)}/${a.questions}`, "Per test"],
                      [Timer, `${a.durationMinutes}m`, "Time"],
                      [Target, `${a.passPercent}%`, "Pass"],
                      [RotateCcw, a.maxAttempts, "Attempts"],
                    ]}
                  >
                    {([Icon, v, l]) => (
                      <div class="py-2.5 rounded-xl bg-sunken/60 text-center">
                        <Icon size={14} class="mx-auto text-muted" />
                        <p class="mt-1 text-[16px] font-semibold tabular">{v}</p>
                        <p class="text-[11.5px] uppercase tracking-[0.08em] text-muted">{l}</p>
                      </div>
                    )}
                  </For>
                </div>
                <Show when={a.passRate != null}>
                  <div class="mt-4">
                    <div class="flex justify-between text-[12.5px] text-muted mb-1.5">
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
    questionsPerAttempt: props.a.questionsPerAttempt ?? Math.max(1, Math.floor(props.a.questions / 2) || props.a.questions),
    shuffle: props.a.shuffle,
  });
  const bank = () => props.a.questions;
  const repeats = () => f().questionsPerAttempt * f().maxAttempts > bank();
  const set = (k) => (v) => setF({ ...f(), [k]: v });
  const [busy, setBusy] = createSignal(false);
  const valid = () =>
    f().durationMinutes >= 1 && f().durationMinutes <= 180 && f().passPercent >= 1 && f().passPercent <= 100 && f().maxAttempts >= 1 && f().marksPerQuestion >= 1 && f().questionsPerAttempt >= 1 && f().questionsPerAttempt <= Math.max(1, bank());

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
        <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">{suffix}</span>
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
        <div class="sm:col-span-2">
          {num("questionsPerAttempt", "Questions per attempt", "Qs", 1, Math.max(1, bank()), `Drawn from a bank of ${bank()}. Each attempt picks questions the employee hasn't seen yet.`)}
        </div>
      </div>
      <Show when={repeats() && bank() > 0}>
        <p class="flex items-start gap-2 mt-3 px-3.5 py-2.5 rounded-xl text-[13.5px] badge-warn !flex">
          <TriangleAlert size={15} class="shrink-0 mt-0.5" />
          {f().questionsPerAttempt} questions × {f().maxAttempts} attempts needs {f().questionsPerAttempt * f().maxAttempts} questions, but the bank has {bank()}. Later
          attempts will reuse the questions seen longest ago — add more questions to avoid that.
        </p>
      </Show>
      <div class={cx("flex items-center justify-between gap-4 p-4 mt-4 rounded-2xl border border-line")}>
        <div class="flex items-start gap-3">
          <Shuffle size={17} class="mt-0.5 text-muted" />
          <div>
            <p class="text-[14.5px] font-semibold">Shuffle questions and options</p>
            <p class="text-[13px] text-muted">Every attempt gets its own order.</p>
          </div>
        </div>
        <Toggle checked={f().shuffle} onChange={set("shuffle")} label="Shuffle" />
      </div>
    </Modal>
  );
}
