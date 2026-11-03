// Admin · Video courses: build courses from unlisted YouTube videos
// (sections → videos), assign them like materials (department or company,
// levels), mark them Required (blocks the assessment until completed) or
// Optional, and follow each employee's video activity.

import { createResource, createSignal, createMemo, For, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Plus, Pencil, Trash2, Ellipsis, MonitorPlay, Send, Users, ArrowUp, ArrowDown, Link2, Clock, ListVideo, CircleCheck, Circle, ChevronDown, Loader } from "lucide-solid";
import { cx, fmtDate, fmtRelative } from "../../lib/format";
import { toast } from "../../store/toast";
import { listCourses, getCourse, getCourseProgress, saveCourse, setCourseStatus, setCourseRequired, deleteCourse, listDepartments } from "../../services/admin";
import { PageHeader, Skeleton, Toggle, Menu, MenuItem, Drawer, Field, ConfirmDialog, EmptyState, ProgressBar, SearchInput, FormError } from "../../components/ui";
import { LEVELS } from "../../lib/levels";
import { youtubeId, thumbnail, clock, totalLength } from "../../lib/youtube";
import { probeVideo } from "../../lib/ytProbe";
import { courseToForm, formToPayload, formProblems, blankLesson, blankSection, move } from "../../lib/courseForm";

export default function Courses() {
  const [list, { refetch, mutate }] = createResource(listCourses);
  const [departments] = createResource(listDepartments);
  const [editing, setEditing] = createSignal(null); // course (full) or {} for new
  const [removing, setRemoving] = createSignal(null);
  const [watching, setWatching] = createSignal(null); // course for the progress drawer

  const open = async (c) => {
    try {
      setEditing(await getCourse(c.id));
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };
  const toggleRequired = async (c, v) => {
    mutate(list().map((x) => (x.id === c.id ? { ...x, required: v } : x)));
    try {
      await setCourseRequired(c.id, v);
      toast(v ? `“${c.title}” is now required before the assessment.` : `“${c.title}” is now optional.`);
    } catch (e) {
      toast(e.message, { tone: "error" });
      refetch();
    }
  };

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="Learning"
        title="Video courses"
        subtitle="Courses built from unlisted YouTube videos, watched inside the portal. Required courses must be completed before the assessment unlocks."
        actions={
          <button class="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={16} /> Add course
          </button>
        }
      />

      <Show when={list()} fallback={<div class="grid gap-3"><For each={[1, 2, 3]}>{() => <Skeleton class="h-[104px] !rounded-2xl" />}</For></div>}>
        <Show
          when={list().length}
          fallback={
            <div class="card">
              <EmptyState icon={<MonitorPlay size={24} />} title="No courses yet" action={<button class="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Add course</button>}>
                Add sections and paste your unlisted YouTube links. Employees watch them in the portal and you see their progress here.
              </EmptyState>
            </div>
          }
        >
          <div class="grid gap-3 stagger">
            <For each={list()}>
              {(c) => (
                <article class="card card-hover grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_170px_150px_auto] items-center gap-x-4 gap-y-3 p-4">
                  <span class="relative block w-[88px] sm:w-[112px] aspect-video rounded-xl overflow-hidden bg-plum-950">
                    <Show when={c.thumbnail}>
                      <img src={thumbnail(c.thumbnail)} alt="" loading="lazy" class="w-full h-full object-cover" />
                    </Show>
                  </span>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h2 class="min-w-0 text-[15.5px] font-semibold line-clamp-2 break-words" title={c.title}>{c.title}</h2>
                      <Show when={c.status === "draft"}>
                        <span class="badge badge-warn">Draft · not visible to employees</span>
                      </Show>
                    </div>
                    <p class="mt-1 text-[13px] text-muted truncate">
                      {c.departmentName} · {c.levelsLabel} · {c.sectionsCount} section{c.sectionsCount === 1 ? "" : "s"} · {c.lessonsCount} video{c.lessonsCount === 1 ? "" : "s"} · {totalLength(c.durationSeconds)} · updated {fmtDate(c.updatedAt)}
                    </p>
                  </div>
                  <div class="col-span-2 md:col-span-1">
                    <div class="flex justify-between text-[12.5px] text-muted mb-1.5">
                      <span>Completed</span>
                      <span class="tabular">
                        {c.completed}/{c.audience}
                      </span>
                    </div>
                    <ProgressBar value={c.audience ? (c.completed / c.audience) * 100 : 0} tone="plum" />
                  </div>
                  <label class="flex items-center gap-2.5 text-[13.5px] font-medium text-ink-2 cursor-pointer">
                    <Toggle checked={c.required} onChange={(v) => toggleRequired(c, v)} label={`Required: ${c.title}`} />
                    {c.required ? "Required" : "Optional"}
                  </label>
                  <div class="flex items-center gap-1 justify-end">
                    <button class="btn btn-secondary btn-sm" onClick={() => setWatching(c)}>
                      <Users size={14} /> Progress
                    </button>
                    <Menu
                      trigger={(o, toggle) => (
                        <button class="btn btn-ghost btn-icon !w-9 !h-9" onClick={toggle} aria-label={`Actions for ${c.title}`}>
                          <Ellipsis size={17} />
                        </button>
                      )}
                    >
                      <MenuItem icon={<Pencil size={15} />} onClick={() => open(c)}>
                        Edit
                      </MenuItem>
                      <Show when={c.status === "draft"}>
                        <MenuItem
                          icon={<Send size={15} />}
                          onClick={async () => {
                            try {
                              await setCourseStatus(c.id, "published");
                              toast(`“${c.title}” is now live for the selected employees.`, { title: "Published" });
                              refetch();
                            } catch (e) {
                              toast(e.message, { tone: "error" });
                            }
                          }}
                        >
                          Publish
                        </MenuItem>
                      </Show>
                      <MenuItem icon={<Trash2 size={15} />} danger onClick={() => setRemoving(c)}>
                        Delete
                      </MenuItem>
                    </Menu>
                  </div>
                </article>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={editing()}>
        <CourseBuilder
          c={editing()}
          departments={departments() ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      </Show>
      <Show when={watching()}>
        <ProgressDrawer c={watching()} onClose={() => setWatching(null)} />
      </Show>
      <Show when={removing()}>
        <ConfirmDialog
          title={`Delete “${removing().title}”?`}
          message="It disappears for every employee. If anyone has started it, it's archived instead so their activity is kept."
          confirmLabel="Delete course"
          tone="danger"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try {
              const r = await deleteCourse(removing().id);
              toast(r?.archived ? "Course archived — employees' activity is kept." : "Course deleted.");
              refetch();
            } catch (e) {
              toast(e.message, { tone: "error" });
            }
          }}
        />
      </Show>
    </div>
  );
}

// ── Builder ─────────────────────────────────────────────────────────────────

function CourseBuilder(props) {
  const isNew = !props.c.id;
  const isDraft = () => isNew || props.c.status === "draft";
  const [f, setF] = createStore(courseToForm(isNew ? null : props.c));
  const [touched, setTouched] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);
  const problems = createMemo(() => formProblems(f));
  const err = (k) => touched() && problems()[k];

  const toggleLevel = (k, on) => setF("levels", on ? [...new Set([...f.levels, k])] : f.levels.filter((x) => x !== k));

  // Fill in the length (and title, if empty) from YouTube.
  const probe = async (si, li) => {
    const l = f.sections[si]?.lessons[li];
    const id = youtubeId(l?.video);
    if (!id) return;
    const lessonKey = l.key;
    const at = () => {
      for (const [a, s] of f.sections.entries()) {
        const b = s.lessons.findIndex((x) => x.key === lessonKey);
        if (b >= 0) return [a, b];
      }
      return null;
    };
    setF("sections", si, "lessons", li, { probing: true, probeError: null });
    try {
      const info = await probeVideo(id);
      const pos = at();
      if (!pos) return;
      setF(
        "sections",
        pos[0],
        "lessons",
        pos[1],
        produce((x) => {
          x.duration = clock(info.durationSeconds);
          if (!x.title.trim() && info.title) x.title = info.title;
          x.probing = false;
        }),
      );
    } catch (e) {
      const pos = at();
      if (pos) setF("sections", pos[0], "lessons", pos[1], { probing: false, probeError: e.message });
    }
  };

  const save = async (status) => {
    setTouched(true);
    if (Object.keys(problems()).length) {
      setError("Some fields need attention — they're marked in red.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveCourse({ id: props.c.id, ...formToPayload(f, status) });
      toast(status === "draft" ? "Saved as a draft. Publish it when it's ready." : isDraft() ? "Course published to the selected employees." : "Course updated.", { title: status === "draft" ? "Draft saved" : "Saved" });
      props.onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Drawer
      width="max-w-[760px]"
      kicker={isNew ? "New course" : "Edit course"}
      title={isNew ? "Add a video course" : props.c.title}
      subtitle="Paste links to unlisted YouTube videos (not private). Video length and title are read from YouTube."
      onClose={() => !busy() && props.onClose()}
      footer={
        <>
          <button class="btn btn-secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <Show
            when={isDraft()}
            fallback={
              <button class="btn btn-primary" onClick={() => save()} disabled={busy()}>
                {busy() ? "Saving…" : "Save changes"}
              </button>
            }
          >
            <button class="btn btn-secondary" onClick={() => save("draft")} disabled={busy()}>
              {busy() ? "Saving…" : "Save as draft"}
            </button>
            <button class="btn btn-primary" onClick={() => save("published")} disabled={busy()}>
              {busy() ? "Publishing…" : "Publish"}
            </button>
          </Show>
        </>
      }
    >
      <div class="grid gap-5">
        <Show when={error()}>
          <FormError class="px-3.5 py-2.5 rounded-xl text-[14px] font-medium badge-danger !flex">{error()}</FormError>
        </Show>

        <Field label="Select Department" for="c-dept" error={err("scope")}>
          <select id="c-dept" class={cx("input", err("scope") && "input-invalid")} value={f.departmentId} onChange={(e) => setF("departmentId", e.currentTarget.value)}>
            <option value="" disabled>
              Choose who gets it…
            </option>
            <option value="company">All departments (company-wide)</option>
            <For each={props.departments}>{(d) => <option value={d.id}>{d.name}</option>}</For>
          </select>
        </Field>

        <div>
          <p class="label">Who gets it</p>
          <div class={cx("rounded-2xl border divide-y divide-line", err("levels") ? "border-crimson-400" : "border-line")}>
            <For each={LEVELS}>
              {(lv) => (
                <label class="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
                  <span class="text-[14.5px] font-semibold">{lv.plural}</span>
                  <Toggle checked={f.levels.includes(lv.key)} onChange={(v) => toggleLevel(lv.key, v)} label={lv.plural} />
                </label>
              )}
            </For>
          </div>
          <Show when={err("levels")}>
            <p class="error-text">{err("levels")}</p>
          </Show>
        </div>

        <Field label="Course title" for="c-title" error={err("title")}>
          <input id="c-title" class={cx("input", err("title") && "input-invalid")} value={f.title} onInput={(e) => setF("title", e.currentTarget.value)} placeholder="e.g. Facebook Ads Mastery" />
        </Field>
        <Field label="Description" for="c-desc" optional hint="Shown on the course card and under the player.">
          <textarea id="c-desc" rows="3" class="input" value={f.description} onInput={(e) => setF("description", e.currentTarget.value)} />
        </Field>

        <div>
          <div class={cx("flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border", err("required") ? "border-crimson-400" : "border-line")}>
            <div>
              <p class="text-[14.5px] font-semibold">Required before the assessment?</p>
              <p class="text-[13px] text-muted">Required: every video must be watched before the test unlocks.</p>
            </div>
            <div class="flex rounded-xl border border-line overflow-hidden" role="radiogroup" aria-label="Required before the assessment">
              <For
                each={[
                  [true, "Required"],
                  [false, "Optional"],
                ]}
              >
                {([v, l]) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={f.required === v}
                    class={cx("px-3.5 h-9 text-[13.5px] font-semibold transition", f.required === v ? "bg-plum-700 text-white dark:bg-lime-400 dark:text-plum-950" : "text-ink-2 hover:bg-sunken")}
                    onClick={() => setF("required", v)}
                  >
                    {l}
                  </button>
                )}
              </For>
            </div>
          </div>
          <Show when={err("required")}>
            <p class="error-text">{err("required")}</p>
          </Show>
        </div>

        {/* Sections → videos */}
        <div class="grid gap-4">
          <p class="label !mb-0">Course content</p>
          <For each={f.sections}>
            {(s, si) => (
              <section class="rounded-2xl border border-line p-3 sm:p-4 grid gap-3 bg-sunken/30">
                <div class="flex items-center gap-2">
                  <span class="shrink-0 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Section {si() + 1}</span>
                  <input
                    class={cx("input flex-1 min-w-0", err(`s${si()}`) && "input-invalid")}
                    placeholder="Section title, e.g. Intro to Facebook marketing"
                    aria-label={`Section ${si() + 1} title`}
                    value={s.title}
                    onInput={(e) => setF("sections", si(), "title", e.currentTarget.value)}
                  />
                  <button type="button" class="btn btn-ghost btn-icon !w-8 !h-8 shrink-0" disabled={si() === 0} onClick={() => setF("sections", move(f.sections, si(), -1))} aria-label="Move section up">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" class="btn btn-ghost btn-icon !w-8 !h-8 shrink-0" disabled={si() === f.sections.length - 1} onClick={() => setF("sections", move(f.sections, si(), 1))} aria-label="Move section down">
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" class="btn btn-ghost btn-icon !w-8 !h-8 shrink-0 hover:!text-crimson-600" disabled={f.sections.length === 1} onClick={() => setF("sections", f.sections.filter((_, k) => k !== si()))} aria-label="Delete section">
                    <Trash2 size={15} />
                  </button>
                </div>
                <Show when={err(`s${si()}`)}>
                  <p class="error-text !mt-0">{err(`s${si()}`)}</p>
                </Show>

                <For each={s.lessons}>
                  {(l, li) => {
                    const id = () => youtubeId(l.video);
                    const k = () => `s${si()}l${li()}`;
                    return (
                      <div class={cx("rounded-xl border bg-surface p-3 grid gap-2.5", err(k()) ? "border-crimson-400" : "border-line")}>
                        <div class="flex items-start gap-3">
                          <span class="shrink-0 w-[96px] aspect-video rounded-lg overflow-hidden bg-plum-950 grid place-items-center text-white/50">
                            <Show when={id()} fallback={<MonitorPlay size={18} />}>
                              <img src={thumbnail(id())} alt="" class="w-full h-full object-cover" />
                            </Show>
                          </span>
                          <div class="flex-1 min-w-0 grid gap-2">
                            <div class="relative">
                              <Link2 size={15} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                              <input
                                class="input pl-9"
                                inputmode="url"
                                placeholder="YouTube link, e.g. https://youtu.be/…"
                                aria-label={`Video ${li() + 1} link`}
                                value={l.video}
                                onInput={(e) => setF("sections", si(), "lessons", li(), { video: e.currentTarget.value, probeError: null })}
                                onChange={() => probe(si(), li())}
                              />
                            </div>
                            <input class="input" placeholder="Video title" aria-label={`Video ${li() + 1} title`} value={l.title} onInput={(e) => setF("sections", si(), "lessons", li(), "title", e.currentTarget.value)} />
                          </div>
                          <div class="shrink-0 flex flex-col gap-1">
                            <button type="button" class="btn btn-ghost btn-icon !w-8 !h-8" disabled={li() === 0} onClick={() => setF("sections", si(), "lessons", move(s.lessons, li(), -1))} aria-label="Move video up">
                              <ArrowUp size={14} />
                            </button>
                            <button type="button" class="btn btn-ghost btn-icon !w-8 !h-8" disabled={li() === s.lessons.length - 1} onClick={() => setF("sections", si(), "lessons", move(s.lessons, li(), 1))} aria-label="Move video down">
                              <ArrowDown size={14} />
                            </button>
                            <button type="button" class="btn btn-ghost btn-icon !w-8 !h-8 hover:!text-crimson-600" disabled={s.lessons.length === 1} onClick={() => setF("sections", si(), "lessons", s.lessons.filter((_, j) => j !== li()))} aria-label="Delete video">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                          <div class="relative w-[120px]">
                            <Clock size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                            <input class="input pl-8 !h-9 tabular" placeholder="mm:ss" aria-label={`Video ${li() + 1} length`} value={l.duration} onInput={(e) => setF("sections", si(), "lessons", li(), "duration", e.currentTarget.value)} />
                          </div>
                          <Show when={l.probing}>
                            <span class="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                              <Loader size={13} class="animate-spin" /> Reading from YouTube…
                            </span>
                          </Show>
                          <Show when={id() && !l.probing && !l.duration}>
                            <button type="button" class="btn btn-ghost btn-sm" onClick={() => probe(si(), li())}>
                              Read length from YouTube
                            </button>
                          </Show>
                        </div>
                        <textarea rows="2" class="input text-[13.5px]" placeholder="Short description (optional)" aria-label={`Video ${li() + 1} description`} value={l.description} onInput={(e) => setF("sections", si(), "lessons", li(), "description", e.currentTarget.value)} />
                        <Show when={l.probeError}>
                          <p class="text-[12.5px] font-medium text-amber-700 dark:text-amber-300">{l.probeError}</p>
                        </Show>
                        <Show when={err(k())}>
                          <p class="error-text !mt-0">{err(k())}</p>
                        </Show>
                      </div>
                    );
                  }}
                </For>
                <button type="button" class="btn btn-secondary btn-sm justify-self-start" onClick={() => setF("sections", si(), "lessons", [...s.lessons, blankLesson()])}>
                  <Plus size={14} /> Add video
                </button>
              </section>
            )}
          </For>
          <button type="button" class="btn btn-secondary justify-self-start" onClick={() => setF("sections", [...f.sections, blankSection()])}>
            <Plus size={15} /> Add section
          </button>
        </div>
      </div>
    </Drawer>
  );
}

// ── Employee activity ───────────────────────────────────────────────────────

function ProgressDrawer(props) {
  const [report] = createResource(() => props.c.id, getCourseProgress);
  const [q, setQ] = createSignal("");
  const [open, setOpen] = createSignal(null);
  const rows = () => {
    const t = q().trim().toLowerCase();
    return (report()?.employees ?? []).filter((e) => !t || e.name.toLowerCase().includes(t) || e.email.toLowerCase().includes(t));
  };
  return (
    <Drawer width="max-w-[720px]" kicker="Video course · employee activity" title={props.c.title} subtitle="Who opened which video, how much they watched, and who has completed the course." onClose={props.onClose}>
      <Show when={report()} fallback={<div class="grid gap-2"><For each={[1, 2, 3, 4]}>{() => <Skeleton class="h-14" />}</For></div>}>
        <div class="grid gap-3">
          <div class="grid grid-cols-3 gap-2.5">
            <Stat label="Assigned" value={report().employees.length} />
            <Stat label="Started" value={report().employees.filter((e) => e.opened).length} />
            <Stat label="Completed" value={report().employees.filter((e) => e.completed).length} />
          </div>
          <SearchInput placeholder="Search employee…" value={q()} onInput={setQ} />
          <Show when={rows().length} fallback={<p class="py-8 text-center text-[14px] text-muted">No employees match.</p>}>
            <ul class="grid gap-2">
              <For each={rows()}>
                {(e) => (
                  <li class="rounded-xl border border-line overflow-hidden">
                    <button class="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-sunken/50" onClick={() => setOpen(open() === e.id ? null : e.id)} aria-expanded={open() === e.id}>
                      <span class="flex-1 min-w-0">
                        <span class="block text-[14.5px] font-semibold truncate">{e.name}</span>
                        <span class="block text-[12.5px] text-muted truncate">
                          {e.designation ?? e.email} · {e.lastWatchedAt ? `last watched ${fmtRelative(e.lastWatchedAt)}` : "not started"}
                        </span>
                      </span>
                      <span class="w-[120px] shrink-0">
                        <span class="flex justify-between text-[12px] text-muted mb-1">
                          <span class="tabular">
                            {e.lessonsCompleted}/{e.lessonsTotal}
                          </span>
                          <span class="tabular font-semibold text-ink-2">{e.percent}%</span>
                        </span>
                        <ProgressBar value={e.percent} />
                      </span>
                      <ChevronDown size={16} class={cx("shrink-0 text-muted transition", open() === e.id && "rotate-180")} />
                    </button>
                    <Show when={open() === e.id}>
                      <div class="border-t border-line px-3.5 py-2 bg-sunken/30">
                        <For each={report().sections}>
                          {(s, si) => (
                            <div class="py-1.5">
                              <p class="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
                                Section {si() + 1}: {s.title}
                              </p>
                              <ul class="mt-1 grid gap-1">
                                <For each={s.lessons}>
                                  {(l) => {
                                    const p = () => e.lessons.find((x) => x.id === l.id);
                                    return (
                                      <li class="flex items-center gap-2 text-[13.5px]">
                                        <span class={cx("shrink-0", p()?.completed ? "text-emerald-600" : p()?.opened ? "text-amber-600" : "text-muted")}>
                                          <Show when={p()?.completed} fallback={<Circle size={14} />}>
                                            <CircleCheck size={14} />
                                          </Show>
                                        </span>
                                        <span class="flex-1 min-w-0 truncate">{l.title}</span>
                                        <span class="shrink-0 text-[12.5px] text-muted tabular">
                                          {p()?.completed ? "Completed" : p()?.opened ? `Opened · ${p().percent}% watched` : "Not opened"} · {clock(l.durationSeconds)}
                                        </span>
                                      </li>
                                    );
                                  }}
                                </For>
                              </ul>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Show>
    </Drawer>
  );
}

function Stat(props) {
  return (
    <div class="p-3 rounded-xl bg-sunken/60">
      <p class="text-[12.5px] text-muted">{props.label}</p>
      <p class="text-[20px] font-semibold tabular">{props.value}</p>
    </div>
  );
}
