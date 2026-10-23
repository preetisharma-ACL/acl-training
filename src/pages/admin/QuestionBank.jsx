// Admin · Question bank for one assessment (department + level): four options per question, one
// correct. Edits apply to new attempts.

import { createResource, createSignal, createMemo, For, Show, Index } from "solid-js";
import { ArrowLeft, Plus, Pencil, Trash2, Check, Settings2, ListChecks, Timer, Target, RotateCcw, CircleQuestionMark } from "lucide-solid";
import { Link } from "../../lib/router";
import { cx } from "../../lib/format";
import { toast } from "../../store/toast";
import { listQuestions, listAssessments, saveQuestion, deleteQuestion } from "../../services/admin";
import { Skeleton, Modal, Field, ConfirmDialog, SearchInput, EmptyState } from "../../components/ui";
import { DeptIcon } from "../../components/icons";
import { SettingsModal } from "./Assessments";

const LETTERS = ["A", "B", "C", "D"];

export default function QuestionBank(props) {
  const deptId = props.params.id; // the assessment id
  const [questions, { refetch }] = createResource(() => listQuestions(deptId));
  const [assessments, { refetch: refetchA }] = createResource(listAssessments);
  const a = () => assessments()?.find((x) => x.id === deptId);
  const [q, setQ] = createSignal("");
  const [editing, setEditing] = createSignal(null);
  const [removing, setRemoving] = createSignal(null);
  const [settings, setSettings] = createSignal(false);

  const rows = createMemo(() => {
    const t = q().trim().toLowerCase();
    return (questions() ?? []).map((x, i) => ({ ...x, n: i + 1 })).filter((x) => !t || x.text.toLowerCase().includes(t) || x.options.some((o) => o.toLowerCase().includes(t)));
  });

  return (
    <div class="grid gap-6">
      <Link href="/admin/assessments" class="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink w-fit">
        <ArrowLeft size={15} /> All assessments
      </Link>

      <section class="relative overflow-hidden rounded-[24px] hero-aurora-soft grain text-white">
        <div class="relative z-[1] flex flex-wrap items-center gap-5 p-6 sm:p-7">
          <span class="grid place-items-center w-14 h-14 rounded-2xl glass">
            <DeptIcon id={a()?.departmentId} size={24} class="text-lime-300" />
          </span>
          <div class="flex-1 min-w-[200px]">
            <p class="eyebrow-lime">Question bank</p>
            <h1 class="mt-1 text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em]">{a()?.name ?? "…"}</h1>
          </div>
          <Show when={a()}>
            <div class="flex flex-wrap gap-2">
              <For
                each={[
                  [ListChecks, `${questions()?.length ?? "—"} questions`],
                  [Timer, `${a().durationMinutes} min`],
                  [Target, `Pass ${a().passPercent}%`],
                  [RotateCcw, `${a().maxAttempts} attempts`],
                ]}
              >
                {([Icon, t]) => (
                  <span class="badge glass text-white/90 px-3 py-1.5 text-[13px]">
                    <Icon size={13} class="text-lime-300" /> {t}
                  </span>
                )}
              </For>
            </div>
          </Show>
          <div class="flex gap-2 w-full sm:w-auto">
            <button class="btn btn-glass" onClick={() => setSettings(true)} disabled={!a()}>
              <Settings2 size={15} /> Settings
            </button>
            <button class="btn btn-lime" onClick={() => setEditing({})}>
              <Plus size={16} /> Add question
            </button>
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        <SearchInput class="flex-1 min-w-[220px] max-w-lg" placeholder="Search questions and options…" value={q()} onInput={setQ} />
        <span class="text-[13.5px] text-muted">Correct answers are marked in lime. Success rates come from attempts taken in the portal.</span>
      </div>

      <Show when={questions()} fallback={<div class="grid gap-3"><For each={[1, 2, 3]}>{() => <Skeleton class="h-[170px] !rounded-2xl" />}</For></div>}>
        <Show
          when={rows().length}
          fallback={
            <div class="card">
              <EmptyState icon={<CircleQuestionMark size={24} />} title={questions().length ? "No matches" : "No questions yet"} action={<button class="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Add question</button>}>
                {questions().length ? "Try a different search." : "Employees can't start this assessment until it has at least one question."}
              </EmptyState>
            </div>
          }
        >
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger">
            <For each={rows()}>
              {(item) => (
                <article class="card p-5 flex flex-col">
                  <div class="flex items-start gap-3">
                    <span class="grid place-items-center shrink-0 w-8 h-8 rounded-lg bg-plum-700 text-white dark:bg-lime-400 dark:text-plum-950 text-[13px] font-semibold tabular">
                      {item.n}
                    </span>
                    <h3 class="flex-1 text-[15.5px] font-semibold leading-snug pt-1">{item.text}</h3>
                    <div class="flex gap-0.5 -mt-1 -mr-1">
                      <button class="btn btn-ghost btn-icon !w-8 !h-8" onClick={() => setEditing(item)} aria-label="Edit question">
                        <Pencil size={14} />
                      </button>
                      <button class="btn btn-ghost btn-icon !w-8 !h-8 hover:!text-crimson-600" onClick={() => setRemoving(item)} aria-label="Delete question">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    <Index each={item.options}>
                      {(o, i) => (
                        <li
                          class={cx(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[14px] border",
                            i === item.answer ? "bg-lime-100/80 border-lime-300 text-lime-900 dark:bg-lime-400/10 dark:border-lime-400/30 dark:text-lime-200 font-medium" : "border-line text-ink-2",
                          )}
                        >
                          <span class={cx("grid place-items-center shrink-0 w-6 h-6 rounded-md text-[12px] font-bold", i === item.answer ? "bg-lime-400 text-plum-950" : "bg-sunken")}>
                            <Show when={i === item.answer} fallback={LETTERS[i]}>
                              <Check size={12} stroke-width={3} />
                            </Show>
                          </span>
                          {o()}
                        </li>
                      )}
                    </Index>
                  </ul>
                  <Show when={item.stats}>
                    <p class="mt-3 text-[12.5px] text-muted">
                      Answered correctly {Math.round((item.stats.correct / item.stats.seen) * 100)}% of the time ({item.stats.seen} attempts)
                    </p>
                  </Show>
                </article>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={editing()}>
        <QuestionModal
          q={editing()}
          deptId={deptId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      </Show>
      <Show when={removing()}>
        <ConfirmDialog
          title="Delete this question?"
          message={`“${removing().text}” will no longer appear in new attempts.`}
          confirmLabel="Delete question"
          tone="danger"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await deleteQuestion(deptId, removing().id);
            toast("Question deleted.");
            refetch();
          }}
        />
      </Show>
      <Show when={settings() && a()}>
        <SettingsModal
          a={a()}
          onClose={() => setSettings(false)}
          onSaved={() => {
            setSettings(false);
            refetchA();
          }}
        />
      </Show>
    </div>
  );
}

function QuestionModal(props) {
  const isNew = !props.q.id;
  const [text, setText] = createSignal(props.q.text ?? "");
  const [options, setOptions] = createSignal(props.q.options ? [...props.q.options] : ["", "", "", ""]);
  const [answer, setAnswer] = createSignal(props.q.answer ?? 0);
  const [touched, setTouched] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  const dupes = () => {
    const t = options().map((o) => o.trim().toLowerCase()).filter(Boolean);
    return new Set(t).size !== t.length;
  };
  const errors = () => ({
    text: text().trim().length < 8 ? "Write the question (at least 8 characters)." : null,
    options: options().some((o) => !o.trim()) ? "Fill in all four options." : dupes() ? "Options must be different." : null,
  });
  const valid = () => !errors().text && !errors().options;

  const save = async () => {
    setTouched(true);
    if (!valid()) return;
    setBusy(true);
    await saveQuestion(props.deptId, { id: props.q.id, text: text(), options: options(), answer: answer() });
    toast(isNew ? "Question added to the bank." : "Question updated.");
    props.onSaved();
  };

  return (
    <Modal
      size="lg"
      title={isNew ? "Add a question" : "Edit question"}
      subtitle="Four options, one correct answer. Pick it with the radio button."
      labelledBy="q-title"
      onClose={() => !busy() && props.onClose()}
      footer={
        <>
          <button class="btn btn-secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={save} disabled={busy()}>
            {busy() ? "Saving…" : isNew ? "Add question" : "Save question"}
          </button>
        </>
      }
    >
      <div class="grid gap-5">
        <Field label="Question" for="q-text" error={touched() && errors().text}>
          <textarea id="q-text" rows="2" class={cx("input resize-none", touched() && errors().text && "input-invalid")} value={text()} onInput={(e) => setText(e.currentTarget.value)} />
        </Field>
        <div role="radiogroup" aria-label="Correct answer">
          <p class="label">Options</p>
          <div class="grid gap-2.5">
            <Index each={options()}>
              {(o, i) => (
                <div class={cx("flex items-center gap-3 p-2 pl-3 rounded-2xl border-[1.5px] transition", answer() === i ? "border-lime-400 bg-lime-50 dark:bg-lime-400/10" : "border-line")}>
                  <input
                    type="radio"
                    name="correct"
                    checked={answer() === i}
                    onChange={() => setAnswer(i)}
                    class="w-4 h-4 accent-lime-600 dark:accent-lime-400"
                    aria-label={`Option ${LETTERS[i]} is correct`}
                  />
                  <span class={cx("grid place-items-center shrink-0 w-7 h-7 rounded-lg text-[13px] font-bold", answer() === i ? "bg-lime-400 text-plum-950" : "bg-sunken text-ink-2")}>{LETTERS[i]}</span>
                  <input
                    class="flex-1 h-10 bg-transparent outline-none text-[15px] font-medium placeholder:text-muted/60"
                    placeholder={`Option ${LETTERS[i]}`}
                    value={o()}
                    onInput={(e) => {
                      const next = [...options()];
                      next[i] = e.currentTarget.value;
                      setOptions(next);
                    }}
                  />
                  <Show when={answer() === i}>
                    <span class="badge badge-lime mr-1">Correct</span>
                  </Show>
                </div>
              )}
            </Index>
          </div>
          <Show when={touched() && errors().options}>
            <p class="error-text">{errors().options}</p>
          </Show>
        </div>
      </div>
    </Modal>
  );
}
