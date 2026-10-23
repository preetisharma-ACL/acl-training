// Admin · Training materials: the library behind every employee's module.
// PDFs are uploaded, manuals are written here (mini-markdown with a live
// preview), structured guides come from the department playbooks.

import { createResource, createSignal, createMemo, For, Show, onMount } from "solid-js";
import { Plus, Eye, Pencil, Trash2, Ellipsis, Upload, FileText, ScrollText, Layers, Library, CircleCheck, X, Info } from "lucide-solid";
import { navigate, query } from "../../lib/router";
import { cx, fmtDate, fmtBytes } from "../../lib/format";
import { toast } from "../../store/toast";
import { user } from "../../store/auth";
import {
  listMaterials,
  listDepartments,
  saveMaterial,
  deleteMaterial,
  setMaterialRequired,
  getMaterialForAdmin,
  parseManual,
  manualToText,
} from "../../services/admin";
import { PageHeader, Tabs, SearchInput, Skeleton, Toggle, Menu, MenuItem, Drawer, Field, ConfirmDialog, EmptyState, ProgressBar } from "../../components/ui";
import { TypeIcon, MATERIAL_TYPES } from "../../components/icons";

const TYPE_TILE = {
  pdf: "bg-crimson-50 text-crimson-600 dark:bg-crimson-500/15 dark:text-crimson-300",
  manual: "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200",
  structured: "bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300",
};

export default function Materials() {
  const [list, { refetch, mutate }] = createResource(listMaterials);
  const [departments] = createResource(listDepartments);
  const [type, setType] = createSignal("all");
  const [dept, setDept] = createSignal("");
  const [q, setQ] = createSignal("");
  const [editing, setEditing] = createSignal(null);
  const [removing, setRemoving] = createSignal(null);

  onMount(() => query().get("new") && setEditing({}));

  const rows = createMemo(() => {
    const t = q().trim().toLowerCase();
    return (list() ?? []).filter(
      (m) =>
        (type() === "all" || m.type === type()) &&
        (!dept() || (dept() === "company" ? !m.departmentId : m.departmentId === dept())) &&
        (!t || m.title.toLowerCase().includes(t)),
    );
  });
  const count = (t) => (list() ?? []).filter((m) => t === "all" || m.type === t).length;

  const toggleRequired = async (m, v) => {
    mutate(list().map((x) => (x.id === m.id ? { ...x, required: v } : x)));
    await setMaterialRequired(m.id, v);
    toast(v ? `“${m.title}” is now required.` : `“${m.title}” is now optional.`);
  };

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="Learning"
        title="Training materials"
        subtitle="Everything employees read before their assessment. Required materials must be completed to unlock the test."
        actions={
          <button class="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={16} /> Add material
          </button>
        }
      />

      <div class="flex flex-wrap items-center gap-3">
        <Tabs
          value={type()}
          onChange={setType}
          tabs={[
            { id: "all", label: "All", count: count("all") },
            { id: "pdf", label: "PDFs", icon: FileText, count: count("pdf") },
            { id: "manual", label: "Manuals", icon: ScrollText, count: count("manual") },
            { id: "structured", label: "Guides", icon: Layers, count: count("structured") },
          ]}
        />
        <SearchInput class="flex-1 min-w-[200px]" placeholder="Search materials…" value={q()} onInput={setQ} />
        <select class="input !w-auto min-w-[180px]" value={dept()} onChange={(e) => setDept(e.currentTarget.value)} aria-label="Filter by audience">
          <option value="">Every audience</option>
          <option value="company">Company-wide</option>
          <For each={departments()}>{(d) => <option value={d.id}>{d.name}</option>}</For>
        </select>
      </div>

      <Show when={list()} fallback={<div class="grid gap-3"><For each={[1, 2, 3, 4]}>{() => <Skeleton class="h-[92px] !rounded-2xl" />}</For></div>}>
        <Show
          when={rows().length}
          fallback={
            <div class="card">
              <EmptyState icon={<Library size={24} />} title="No materials found" action={<button class="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Add material</button>}>
                Try another filter, or add a new PDF or manual.
              </EmptyState>
            </div>
          }
        >
          <div class="grid gap-3 stagger">
            <For each={rows()}>
              {(m) => (
                <article class="card card-hover grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_170px_150px_auto] items-center gap-x-4 gap-y-3 p-4">
                  <span class={cx("grid place-items-center w-12 h-12 rounded-2xl", TYPE_TILE[m.type])}>
                    <TypeIcon type={m.type} size={21} />
                  </span>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <button class="text-[14.5px] font-semibold text-left hover:text-plum-700 dark:hover:text-lime-300 truncate" onClick={() => navigate(`/admin/materials/${m.id}`)}>
                        {m.title}
                      </button>
                      <span class={cx("badge", MATERIAL_TYPES[m.type].badge)}>{MATERIAL_TYPES[m.type].short}</span>
                    </div>
                    <p class="mt-1 text-[12px] text-muted truncate">
                      {m.departmentName} · v{m.version} · {m.estMinutes} min · updated {fmtDate(m.updatedAt)}
                      <Show when={m.sizeBytes}> · {fmtBytes(m.sizeBytes)}</Show>
                      <Show when={m.sections}> · {m.sections} {m.type === "manual" ? "chapters" : "sections"}</Show>
                    </p>
                  </div>
                  <div class="col-span-2 md:col-span-1">
                    <div class="flex justify-between text-[11.5px] text-muted mb-1.5">
                      <span>Completed</span>
                      <span class="tabular">
                        {m.completed}/{m.audience}
                      </span>
                    </div>
                    <ProgressBar value={m.audience ? (m.completed / m.audience) * 100 : 0} tone="plum" />
                  </div>
                  <label class="flex items-center gap-2.5 text-[12.5px] font-medium text-ink-2 cursor-pointer">
                    <Toggle checked={m.required} onChange={(v) => toggleRequired(m, v)} label={`Required: ${m.title}`} />
                    {m.required ? "Required" : "Optional"}
                  </label>
                  <div class="flex items-center gap-1 justify-end">
                    <button class="btn btn-secondary btn-sm" onClick={() => navigate(`/admin/materials/${m.id}`)}>
                      <Eye size={14} /> Preview
                    </button>
                    <Menu
                      trigger={(open, toggle) => (
                        <button class="btn btn-ghost btn-icon !w-9 !h-9" onClick={toggle} aria-label={`Actions for ${m.title}`}>
                          <Ellipsis size={17} />
                        </button>
                      )}
                    >
                      <MenuItem icon={<Pencil size={15} />} onClick={async () => setEditing(await getMaterialForAdmin(m.id))}>
                        Edit
                      </MenuItem>
                      <MenuItem icon={<Trash2 size={15} />} danger onClick={() => setRemoving(m)}>
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
        <MaterialDrawer
          m={editing()}
          departments={departments() ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      </Show>
      <Show when={removing()}>
        <ConfirmDialog
          title={`Delete “${removing().title}”?`}
          message="It disappears from every employee's module, along with their reading progress for it."
          confirmLabel="Delete material"
          tone="danger"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await deleteMaterial(removing().id);
            toast("Material deleted.");
            refetch();
          }}
        />
      </Show>
    </div>
  );
}

const MANUAL_TEMPLATE = `# Introduction

Start with why this matters. Blank lines separate paragraphs.

## A sub-heading

- Bullet points start with a dash
- Keep each point to one idea

> Lines starting with ">" become a highlighted note.

# Next chapter

1. Numbered steps work too
2. Like this`;

function MaterialDrawer(props) {
  const isNew = !props.m.id;
  const [type, setType] = createSignal(props.m.type ?? "pdf");
  const [f, setF] = createSignal({
    title: props.m.title ?? "",
    description: props.m.description ?? "",
    departmentId: props.m.departmentId ?? "",
    required: props.m.required ?? true,
    estMinutes: props.m.estMinutes ?? 5,
  });
  const set = (k) => (v) => setF({ ...f(), [k]: v });
  const [file, setFile] = createSignal(null);
  const [drag, setDrag] = createSignal(false);
  const [text, setText] = createSignal(props.m.type === "manual" && props.m.content ? manualToText(props.m.content) : MANUAL_TEMPLATE);
  const [mode, setMode] = createSignal("write");
  const [busy, setBusy] = createSignal(false);
  const [touched, setTouched] = createSignal(false);
  const [error, setError] = createSignal(null);
  const preview = createMemo(() => (type() === "manual" ? parseManual(text()) : null));

  const pick = (fl) => {
    if (!fl) return;
    if (fl.type !== "application/pdf" && !fl.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    if (fl.size > 25 * 1024 * 1024) {
      setError("That file is larger than 25 MB.");
      return;
    }
    setError(null);
    setFile(fl);
    if (!f().title) set("title")(fl.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " "));
  };

  const errors = () => ({
    title: f().title.trim().length < 3 ? "Give it a clear title." : null,
    file: isNew && type() === "pdf" && !file() ? "Upload a PDF." : null,
    manual: type() === "manual" && text().trim().length < 20 ? "Write the manual content." : null,
  });
  const valid = () => !Object.values(errors()).some(Boolean);

  const save = async () => {
    setTouched(true);
    if (!valid()) return;
    setBusy(true);
    setError(null);
    try {
      await saveMaterial({ id: props.m.id, type: type(), ...f(), file: file(), manualText: type() === "manual" ? text() : null, author: user().name });
      toast(isNew ? "Material published to the selected employees' modules." : "Material updated — employees see the new version.", { title: isNew ? "Published" : "Saved" });
      props.onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Drawer
      width="max-w-[640px]"
      kicker={isNew ? "New material" : `Edit · ${MATERIAL_TYPES[type()].label}`}
      title={isNew ? "Add training material" : props.m.title}
      subtitle={isNew ? "Upload a PDF or write a manual. Employees see it in their module right away." : `Version ${props.m.version} — saving publishes the next version.`}
      onClose={() => !busy() && props.onClose()}
      footer={
        <>
          <button class="btn btn-secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={save} disabled={busy()}>
            {busy() ? "Publishing…" : isNew ? "Publish material" : "Save new version"}
          </button>
        </>
      }
    >
      <div class="grid gap-5">
        <Show when={error()}>
          <p class="px-3.5 py-2.5 rounded-xl text-[13px] font-medium badge-danger !flex">{error()}</p>
        </Show>

        <Show when={isNew}>
          <div>
            <p class="label">Type</p>
            <div class="grid grid-cols-2 gap-3">
              <For
                each={[
                  ["pdf", FileText, "PDF document", "Upload an existing file"],
                  ["manual", ScrollText, "Written manual", "Write it right here"],
                ]}
              >
                {([id, Icon, label, hint]) => (
                  <button
                    type="button"
                    onClick={() => setType(id)}
                    class={cx(
                      "flex items-center gap-3 p-3.5 rounded-2xl border-[1.5px] text-left transition",
                      type() === id ? "border-plum-500 bg-plum-50/60 dark:border-lime-400 dark:bg-lime-400/10" : "border-line hover:border-line-strong",
                    )}
                  >
                    <span class={cx("grid place-items-center w-10 h-10 rounded-xl", TYPE_TILE[id])}>
                      <Icon size={18} />
                    </span>
                    <span>
                      <span class="block text-[13.5px] font-semibold">{label}</span>
                      <span class="block text-[11.5px] text-muted">{hint}</span>
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={type() === "pdf"}>
          <div>
            <p class="label">{isNew ? "File" : "Replace file"}</p>
            <label
              class={cx(
                "relative grid justify-items-center gap-2 px-6 py-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition",
                drag() ? "border-plum-500 bg-plum-50 dark:border-lime-400 dark:bg-lime-400/10" : touched() && errors().file ? "border-crimson-400" : "border-line-strong hover:border-plum-400 hover:bg-sunken/40",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                pick(e.dataTransfer.files?.[0]);
              }}
            >
              <input type="file" accept="application/pdf,.pdf" class="sr-only" onChange={(e) => pick(e.currentTarget.files?.[0])} />
              <Show
                when={file()}
                fallback={
                  <>
                    <span class="grid place-items-center w-12 h-12 rounded-2xl bg-plum-50 text-plum-700 dark:bg-lime-400/15 dark:text-lime-300">
                      <Upload size={21} />
                    </span>
                    <p class="text-[13.5px] font-semibold">Drop a PDF here, or <span class="text-plum-700 dark:text-lime-300 underline underline-offset-2">browse</span></p>
                    <p class="text-[12px] text-muted">PDF up to 25 MB{props.m.fileName ? ` · current: ${props.m.fileName}` : ""}</p>
                  </>
                }
              >
                <div class="flex items-center gap-3 w-full p-3 rounded-xl bg-surface border border-line text-left">
                  <span class={cx("grid place-items-center w-10 h-10 rounded-xl", TYPE_TILE.pdf)}>
                    <FileText size={18} />
                  </span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-[13px] font-semibold truncate">{file().name}</span>
                    <span class="block text-[11.5px] text-muted">{fmtBytes(file().size)} · ready to upload</span>
                  </span>
                  <CircleCheck size={18} class="text-emerald-500" />
                  <button
                    type="button"
                    class="grid place-items-center w-8 h-8 rounded-lg text-muted hover:bg-sunken"
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                    }}
                    aria-label="Remove file"
                  >
                    <X size={15} />
                  </button>
                </div>
              </Show>
            </label>
            <Show when={touched() && errors().file}>
              <p class="error-text">{errors().file}</p>
            </Show>
          </div>
        </Show>

        <Field label="Title" for="m-title" error={touched() && errors().title}>
          <input id="m-title" class={cx("input", touched() && errors().title && "input-invalid")} value={f().title} onInput={(e) => set("title")(e.currentTarget.value)} />
        </Field>
        <Field label="Short description" for="m-desc" optional hint="Shown on the material card.">
          <textarea id="m-desc" rows="2" class="input resize-none" value={f().description} onInput={(e) => set("description")(e.currentTarget.value)} />
        </Field>
        <div class="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
          <Field label="Assigned to" for="m-dept">
            <select id="m-dept" class="input" value={f().departmentId} onChange={(e) => set("departmentId")(e.currentTarget.value)} disabled={type() === "structured"}>
              <option value="">All departments (company-wide)</option>
              <For each={props.departments}>{(d) => <option value={d.id}>{d.name}</option>}</For>
            </select>
          </Field>
          <Field label="Reading time" for="m-min">
            <div class="relative">
              <input id="m-min" type="number" min="1" max="240" class="input pr-12" value={f().estMinutes} onInput={(e) => set("estMinutes")(e.currentTarget.value)} />
              <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">min</span>
            </div>
          </Field>
        </div>
        <div class="flex items-center justify-between gap-4 p-4 rounded-2xl border border-line">
          <div>
            <p class="text-[13.5px] font-semibold">Required before the assessment</p>
            <p class="text-[12px] text-muted">Employees must complete it to unlock their test.</p>
          </div>
          <Toggle checked={f().required} onChange={set("required")} label="Required" />
        </div>

        <Show when={type() === "manual"}>
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="label !mb-0">Content</p>
              <Tabs
                value={mode()}
                onChange={setMode}
                tabs={[
                  { id: "write", label: "Write" },
                  { id: "preview", label: "Preview" },
                ]}
              />
            </div>
            <Show
              when={mode() === "write"}
              fallback={
                <div class="max-h-[420px] overflow-y-auto scrollbar-thin p-5 rounded-2xl border border-line bg-surface prose-doc text-[14px]">
                  <For each={preview().chapters}>
                    {(ch, i) => (
                      <section class="mb-6">
                        <p class="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-plum-500 dark:text-lime-300">Chapter {i() + 1}</p>
                        <h3 class="!mt-1">{ch.title}</h3>
                        <For each={ch.blocks}>
                          {(b) =>
                            b.type === "p" ? (
                              <p>{b.text}</p>
                            ) : b.type === "h" ? (
                              <h3 class="!text-[1em]">{b.text}</h3>
                            ) : b.type === "ul" ? (
                              <ul>
                                <For each={b.items}>{(x) => <li>{x}</li>}</For>
                              </ul>
                            ) : b.type === "ol" ? (
                              <ol>
                                <For each={b.items}>{(x) => <li>{x}</li>}</For>
                              </ol>
                            ) : (
                              <p class="!mb-4 px-4 py-3 rounded-xl bg-plum-50/70 dark:bg-plum-400/10 border border-plum-200/60 dark:border-plum-400/20">{b.text}</p>
                            )
                          }
                        </For>
                      </section>
                    )}
                  </For>
                </div>
              }
            >
              <textarea
                rows="14"
                class={cx("input font-mono text-[12.5px] leading-relaxed", touched() && errors().manual && "input-invalid")}
                value={text()}
                onInput={(e) => setText(e.currentTarget.value)}
                spellcheck
              />
            </Show>
            <p class="hint flex items-center gap-1.5">
              <Info size={12} /> <code># Chapter</code> · <code>## Heading</code> · <code>- bullet</code> · <code>1. step</code> · <code>&gt; note</code>
            </p>
          </div>
        </Show>

        <Show when={type() === "structured"}>
          <p class="flex items-start gap-2.5 p-3.5 rounded-2xl bg-sunken/60 text-[12.5px] text-muted">
            <Info size={15} class="shrink-0 mt-0.5" /> Structured guides come from the department playbook. Their sections are edited by the department head; here you can change the title,
            description, reading time and whether it's required.
          </p>
        </Show>
      </div>
    </Drawer>
  );
}
