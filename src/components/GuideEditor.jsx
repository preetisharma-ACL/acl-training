// Structured guide editor (admin): an introduction plus sections, each with
// a title, content paragraphs, key points and an optional tip. Sections can
// be added, removed and reordered; "Preview" shows it as employees will.
//
// Content conversion and validation live in lib/guide.js.

import { For, Show, createSignal } from "solid-js";
import { Plus, Trash2, ArrowUp, ArrowDown, Check, Lightbulb } from "lucide-solid";
import { cx } from "../lib/format";
import { blankSection, editableToGuide, moveSection } from "../lib/guide";
import { Field, Tabs } from "./ui";

// props: guide (store), setGuide (store setter), error
export default function GuideEditor(props) {
  const [mode, setMode] = createSignal("write");
  const sections = () => props.guide.sections;
  const move = (i, d) => props.setGuide("sections", moveSection(sections(), i, d));
  const remove = (i) => props.setGuide("sections", sections().filter((_, k) => k !== i));
  const add = () => props.setGuide("sections", [...sections(), blankSection()]);

  return (
    <div>
      <div class="flex items-center justify-between mb-2">
        <p class="label !mb-0">Guide content</p>
        <Tabs
          value={mode()}
          onChange={setMode}
          tabs={[
            { id: "write", label: "Write" },
            { id: "preview", label: "Preview" },
          ]}
        />
      </div>

      <Show when={mode() === "write"} fallback={<GuidePreview guide={editableToGuide(props.guide)} />}>
        <div class="grid gap-4">
          <Field label="Introduction" for="g-intro" optional hint="A short overview shown above the sections.">
            <textarea id="g-intro" rows="3" class="input" value={props.guide.intro} onInput={(e) => props.setGuide("intro", e.currentTarget.value)} />
          </Field>

          <For each={sections()}>
            {(s, i) => (
              <section class="rounded-2xl border border-line p-4 grid gap-3 bg-sunken/30">
                <div class="flex items-center gap-2">
                  <span class="grid place-items-center w-8 h-8 rounded-lg bg-plum-700 text-white dark:bg-lime-400 dark:text-plum-950 text-[13px] font-semibold tabular shrink-0">
                    {String(i() + 1).padStart(2, "0")}
                  </span>
                  <input
                    class="input flex-1"
                    placeholder="Section title"
                    aria-label={`Section ${i() + 1} title`}
                    value={s.title}
                    onInput={(e) => props.setGuide("sections", i(), "title", e.currentTarget.value)}
                  />
                  <button type="button" class="btn btn-ghost btn-icon !w-8 !h-8" disabled={i() === 0} onClick={() => move(i(), -1)} aria-label="Move section up">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" class="btn btn-ghost btn-icon !w-8 !h-8" disabled={i() === sections().length - 1} onClick={() => move(i(), 1)} aria-label="Move section down">
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" class="btn btn-ghost btn-icon !w-8 !h-8 hover:!text-crimson-600" disabled={sections().length === 1} onClick={() => remove(i())} aria-label="Delete section">
                    <Trash2 size={15} />
                  </button>
                </div>
                <Field label="Content" for={`g-body-${s.id}`} hint="Leave a blank line between paragraphs.">
                  <textarea id={`g-body-${s.id}`} rows="4" class="input" value={s.body} onInput={(e) => props.setGuide("sections", i(), "body", e.currentTarget.value)} />
                </Field>
                <Field label="Key points" for={`g-points-${s.id}`} optional hint="One point per line.">
                  <textarea id={`g-points-${s.id}`} rows="3" class="input" value={s.points} onInput={(e) => props.setGuide("sections", i(), "points", e.currentTarget.value)} />
                </Field>
                <Field label="Tip" for={`g-tip-${s.id}`} optional>
                  <input id={`g-tip-${s.id}`} class="input" value={s.tip} onInput={(e) => props.setGuide("sections", i(), "tip", e.currentTarget.value)} />
                </Field>
              </section>
            )}
          </For>

          <button type="button" class="btn btn-secondary justify-self-start" onClick={add}>
            <Plus size={15} /> Add section
          </button>
        </div>
      </Show>
      <Show when={props.error}>
        <p class="error-text">{props.error}</p>
      </Show>
    </div>
  );
}

// The guide as employees see it (simplified reader styling).
export function GuidePreview(props) {
  return (
    <div class="max-h-[520px] overflow-y-auto scrollbar-thin grid gap-3 p-4 rounded-2xl border border-line bg-canvas text-[15px]">
      <Show when={props.guide.intro}>
        <div class="card p-5">
          <p class="kicker">Introduction</p>
          <p class="mt-2 leading-relaxed text-ink-2">{props.guide.intro}</p>
        </div>
      </Show>
      <For each={props.guide.sections}>
        {(sec, i) => (
          <section class="card p-5">
            <div class="flex items-center gap-3 mb-3">
              <span class="grid place-items-center w-8 h-8 rounded-xl bg-plum-700 text-white dark:bg-lime-400 dark:text-plum-950 text-[13px] font-semibold tabular">
                {String(i() + 1).padStart(2, "0")}
              </span>
              <h3 class={cx("text-[17px] font-semibold", !sec.title && "text-muted italic")}>{sec.title || "Untitled section"}</h3>
            </div>
            <div class="prose-doc">
              <For each={sec.body}>{(p) => <p>{p}</p>}</For>
            </div>
            <Show when={sec.points?.length}>
              <div class="mt-2 p-4 rounded-2xl bg-sunken/60 border border-line/70">
                <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted mb-2">Key points</p>
                <ul class="grid gap-2">
                  <For each={sec.points}>
                    {(pt) => (
                      <li class="flex items-start gap-2.5 text-ink-2">
                        <span class="grid place-items-center shrink-0 w-5 h-5 mt-0.5 rounded-full bg-lime-400 text-plum-950">
                          <Check size={11} stroke-width={3} />
                        </span>
                        {pt}
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </Show>
            <Show when={sec.tip}>
              <div class="flex gap-2.5 mt-3 p-3.5 rounded-2xl bg-lime-100/70 dark:bg-lime-400/10 border border-lime-300/60 dark:border-lime-400/20">
                <Lightbulb size={17} class="shrink-0 mt-0.5 text-lime-700 dark:text-lime-300" />
                <p class="text-ink-2">
                  <strong class="text-ink">Tip · </strong>
                  {sec.tip}
                </p>
              </div>
            </Show>
          </section>
        )}
      </For>
    </div>
  );
}
