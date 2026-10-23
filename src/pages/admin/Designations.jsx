// Admin · Designations: the mapping that decides every employee's department
// (and so their training module). Employees never choose it themselves.

import { createResource, createSignal, createMemo, For, Show } from "solid-js";
import { Plus, Pencil, Trash2, Workflow, TriangleAlert, ArrowRight } from "lucide-solid";
import { cx } from "../../lib/format";
import { toast } from "../../store/toast";
import { listDesignations, listDepartments, saveDesignation, deleteDesignation } from "../../services/admin";
import { PageHeader, Skeleton, Modal, Field, ConfirmDialog, SearchInput } from "../../components/ui";
import { DeptIcon } from "../../components/icons";

const LEVELS = ["Trainee", "Associate", "Senior", "Lead", "Manager"];

export default function Designations() {
  const [list, { refetch }] = createResource(listDesignations);
  const [departments] = createResource(listDepartments);
  const [q, setQ] = createSignal("");
  const [editing, setEditing] = createSignal(null);
  const [removing, setRemoving] = createSignal(null);

  const rows = createMemo(() => {
    const t = q().trim().toLowerCase();
    return (list() ?? []).filter((d) => !t || d.title.toLowerCase().includes(t) || d.departmentName?.toLowerCase().includes(t));
  });
  const unmapped = () => (list() ?? []).filter((d) => !d.departmentId);

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="People"
        title="Designations"
        subtitle="Map each designation to a department. When an employee signs in, their designation decides which training module and assessment they see."
        actions={
          <button class="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={16} /> Add designation
          </button>
        }
      />

      <div class="flex flex-wrap items-center gap-4 p-5 rounded-[22px] hero-aurora-soft grain text-white relative overflow-hidden">
        <span class="relative z-[1] grid place-items-center w-11 h-11 rounded-xl glass">
          <Workflow size={20} class="text-lime-300" />
        </span>
        <div class="relative z-[1] flex flex-wrap items-center gap-2.5 text-[13.5px]">
          <span class="badge glass text-white px-3 py-1.5">Employee signs in</span>
          <ArrowRight size={15} class="text-white/50" />
          <span class="badge glass text-white px-3 py-1.5">Designation</span>
          <ArrowRight size={15} class="text-white/50" />
          <span class="badge bg-lime-400 text-plum-950 px-3 py-1.5">Department</span>
          <ArrowRight size={15} class="text-white/50" />
          <span class="badge glass text-white px-3 py-1.5">Training module + assessment</span>
        </div>
      </div>

      <Show when={unmapped().length}>
        <div class="flex items-start gap-3 p-4 rounded-2xl badge-warn !flex !text-[13px] !font-medium !rounded-2xl !py-3.5">
          <TriangleAlert size={17} class="shrink-0" />
          <span>
            {unmapped().length} designation{unmapped().length > 1 ? "s aren't" : " isn't"} mapped to a department ({unmapped().map((d) => d.title).join(", ")}). Employees with{" "}
            {unmapped().length > 1 ? "these" : "it"} see “no training assigned”.
          </span>
        </div>
      </Show>

      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-line">
          <SearchInput class="flex-1 min-w-[220px] max-w-md" placeholder="Search designations or departments…" value={q()} onInput={setQ} />
          <span class="ml-auto text-[12.5px] text-muted">{rows().length} designations</span>
        </div>
        <Show when={list()} fallback={<div class="p-4 grid gap-2"><For each={[1, 2, 3, 4]}>{() => <Skeleton class="h-11" />}</For></div>}>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Designation</th>
                  <th>Level</th>
                  <th>Department</th>
                  <th class="!text-right">Employees</th>
                  <th class="w-24" />
                </tr>
              </thead>
              <tbody>
                <For each={rows()}>
                  {(d) => (
                    <tr>
                      <td class="font-semibold whitespace-nowrap">{d.title}</td>
                      <td>
                        <span class="badge badge-neutral">{d.level}</span>
                      </td>
                      <td class="whitespace-nowrap">
                        <Show when={d.departmentId} fallback={<span class="badge badge-warn">Unmapped</span>}>
                          <span class="inline-flex items-center gap-2 text-ink-2">
                            <span class="grid place-items-center w-7 h-7 rounded-lg badge-plum !p-0">
                              <DeptIcon id={d.departmentId} size={14} />
                            </span>
                            {d.departmentName}
                          </span>
                        </Show>
                      </td>
                      <td class="text-right tabular">{d.employees}</td>
                      <td>
                        <div class="flex justify-end gap-1">
                          <button class="btn btn-ghost btn-icon !w-8 !h-8" onClick={() => setEditing(d)} aria-label={`Edit ${d.title}`}>
                            <Pencil size={15} />
                          </button>
                          <button class="btn btn-ghost btn-icon !w-8 !h-8 hover:!text-crimson-600" onClick={() => setRemoving(d)} aria-label={`Delete ${d.title}`}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </section>

      <Show when={editing()}>
        <DesignationModal
          des={editing()}
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
          message="Designations that employees still hold can't be deleted — reassign them first."
          confirmLabel="Delete"
          tone="danger"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try {
              await deleteDesignation(removing().id);
              toast("Designation deleted.");
              refetch();
            } catch (e) {
              toast(e.message, { tone: "error", title: "Can't delete yet" });
            }
          }}
        />
      </Show>
    </div>
  );
}

function DesignationModal(props) {
  const isNew = !props.des.id;
  const [title, setTitle] = createSignal(props.des.title ?? "");
  const [level, setLevel] = createSignal(props.des.level ?? "Associate");
  const [dept, setDept] = createSignal(props.des.departmentId ?? "");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveDesignation({ id: props.des.id, title: title(), level: level(), departmentId: dept() });
      toast(isNew ? "Designation added." : `Saved. ${props.des.employees ? `${props.des.employees} employee(s) follow the new mapping.` : ""}`);
      props.onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Add a designation" : `Edit ${props.des.title}`}
      labelledBy="des-title"
      onClose={() => !busy() && props.onClose()}
      footer={
        <>
          <button class="btn btn-secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={save} disabled={title().trim().length < 2 || busy()}>
            {busy() ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div class="grid gap-4">
        <Show when={error()}>
          <p class="px-3.5 py-2.5 rounded-xl text-[13px] font-medium badge-danger !flex">{error()}</p>
        </Show>
        <Field label="Title" for="ds-title">
          <input id="ds-title" class="input" placeholder="e.g. Performance Analyst" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
        </Field>
        <Field label="Level" for="ds-level">
          <select id="ds-level" class="input" value={level()} onChange={(e) => setLevel(e.currentTarget.value)}>
            <For each={LEVELS}>{(l) => <option>{l}</option>}</For>
          </select>
        </Field>
        <Field label="Department" for="ds-dept" hint="Employees with this designation get this department's training module.">
          <select id="ds-dept" class={cx("input")} value={dept()} onChange={(e) => setDept(e.currentTarget.value)}>
            <option value="">No department (no training assigned)</option>
            <For each={props.departments}>{(d) => <option value={d.id}>{d.name}</option>}</For>
          </select>
        </Field>
        <Show when={!isNew && props.des.employees && dept() !== (props.des.departmentId ?? "")}>
          <p class="flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-[12.5px] badge-warn !flex">
            <TriangleAlert size={14} class="shrink-0 mt-0.5" /> {props.des.employees} employee(s) will move to the new department's module on their next sign-in.
          </p>
        </Show>
      </div>
    </Modal>
  );
}
