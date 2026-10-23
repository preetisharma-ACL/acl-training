// Admin · Departments: each one owns a training module and an assessment.

import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Pencil, Trash2, Ellipsis, MapPin, UserRound, ClipboardList, Building2 } from "lucide-solid";
import { navigate } from "../../lib/router";
import { cx } from "../../lib/format";
import { toast } from "../../store/toast";
import { listDepartments, saveDepartment, deleteDepartment } from "../../services/admin";
import { PageHeader, Skeleton, Menu, MenuItem, Modal, Field, Toggle, ConfirmDialog, EmptyState } from "../../components/ui";
import { DeptIcon } from "../../components/icons";

export default function Departments() {
  const [list, { refetch }] = createResource(listDepartments);
  const [editing, setEditing] = createSignal(null);
  const [removing, setRemoving] = createSignal(null);

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="People"
        title="Departments"
        subtitle="Each department has its own training module and assessment. Employees join one through their designation."
        actions={
          <button class="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={16} /> Add department
          </button>
        }
      />

      <Show when={list()} fallback={<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"><For each={[1, 2, 3, 4, 5, 6]}>{() => <Skeleton class="h-[300px] !rounded-2xl" />}</For></div>}>
        <Show when={list().length} fallback={<div class="card"><EmptyState icon={<Building2 size={24} />} title="No departments yet">Add your first department to start assigning training.</EmptyState></div>}>
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            <For each={list()}>
              {(d) => (
                <article class={cx("card card-hover flex flex-col overflow-hidden", !d.active && "opacity-70")}>
                  <div class="relative p-5 pb-4">
                    <div class="flex items-start justify-between gap-3">
                      <span class="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-plum-600 to-plum-900 text-lime-300 shadow-[0_10px_20px_-8px_rgba(84,44,95,0.6)]">
                        <DeptIcon id={d.id} size={22} />
                      </span>
                      <div class="flex items-center gap-1.5">
                        <span class={cx("badge", d.active ? "badge-success" : "badge-neutral")}>{d.active ? "Active" : "Inactive"}</span>
                        <Menu
                          trigger={(open, toggle) => (
                            <button class="btn btn-ghost btn-icon !w-8 !h-8" onClick={toggle} aria-label={`Actions for ${d.name}`}>
                              <Ellipsis size={16} />
                            </button>
                          )}
                        >
                          <MenuItem icon={<Pencil size={15} />} onClick={() => setEditing(d)}>
                            Edit department
                          </MenuItem>
                          <MenuItem icon={<ClipboardList size={15} />} onClick={() => navigate(`/admin/assessments/${d.id}`)}>
                            Question bank
                          </MenuItem>
                          <MenuItem icon={<Trash2 size={15} />} danger onClick={() => setRemoving(d)}>
                            Delete
                          </MenuItem>
                        </Menu>
                      </div>
                    </div>
                    <h2 class="mt-4 text-[17px] font-semibold tracking-[-0.015em]">{d.name}</h2>
                    <p class="mt-1 text-[13px] text-muted leading-relaxed line-clamp-2">{d.description || "No description yet."}</p>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-muted">
                      <span class="inline-flex items-center gap-1.5">
                        <UserRound size={13} /> {d.head || "No head assigned"}
                      </span>
                      <span class="inline-flex items-center gap-1.5">
                        <MapPin size={13} /> {d.location || "—"}
                      </span>
                    </div>
                  </div>
                  <div class="px-5 pb-5 mt-auto">
                    <div class="flex items-center justify-between pt-4 border-t border-line text-[12px] text-muted">
                      <span>
                        {d.durationMinutes} min · pass {d.passPercent}% · {d.maxAttempts} attempts
                      </span>
                      <button class="font-semibold text-plum-700 dark:text-lime-300 hover:underline" onClick={() => navigate(`/admin/assessments/${d.id}`)}>
                        Assessment →
                      </button>
                    </div>
                  </div>
                </article>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={editing()}>
        <DepartmentModal
          dept={editing()}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      </Show>
      <Show when={removing()}>
        <ConfirmDialog
          title={`Delete ${removing().name}?`}
          message="Its training materials and question bank are deleted too. Departments with designations mapped to them can't be deleted."
          confirmLabel="Delete department"
          tone="danger"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try {
              await deleteDepartment(removing().id);
              toast(`${removing().name} was deleted.`);
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

function DepartmentModal(props) {
  const isNew = !props.dept.id;
  const [f, setF] = createSignal({
    id: props.dept.id,
    name: props.dept.name ?? "",
    description: props.dept.description ?? "",
    head: props.dept.head ?? "",
    location: props.dept.location ?? "Lucknow HQ",
    active: props.dept.active ?? true,
  });
  const set = (k) => (v) => setF({ ...f(), [k]: v });
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);
  const ok = () => f().name.trim().length >= 2;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveDepartment(f());
      toast(isNew ? `${f().name} was created with an empty question bank.` : "Department saved.");
      props.onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Add a department" : `Edit ${props.dept.name}`}
      subtitle={isNew ? "You can add materials and questions once it's created." : undefined}
      labelledBy="dept-title"
      onClose={() => !busy() && props.onClose()}
      footer={
        <>
          <button class="btn btn-secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={save} disabled={!ok() || busy()}>
            {busy() ? "Saving…" : isNew ? "Create department" : "Save"}
          </button>
        </>
      }
    >
      <div class="grid gap-4">
        <Show when={error()}>
          <p class="px-3.5 py-2.5 rounded-xl text-[13px] font-medium badge-danger !flex">{error()}</p>
        </Show>
        <Field label="Name" for="d-name">
          <input id="d-name" class="input" placeholder="e.g. Performance Marketing" value={f().name} onInput={(e) => set("name")(e.currentTarget.value)} />
        </Field>
        <Field label="Description" for="d-desc" optional>
          <textarea id="d-desc" rows="3" class="input resize-none" value={f().description} onInput={(e) => set("description")(e.currentTarget.value)} />
        </Field>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Department head" for="d-head" optional>
            <input id="d-head" class="input" value={f().head} onInput={(e) => set("head")(e.currentTarget.value)} />
          </Field>
          <Field label="Location" for="d-loc">
            <select id="d-loc" class="input" value={f().location} onChange={(e) => set("location")(e.currentTarget.value)}>
              <For each={["Lucknow HQ", "Noida", "Gurugram", "Delhi", "Remote-first"]}>{(l) => <option>{l}</option>}</For>
            </select>
          </Field>
        </div>
        <div class="flex items-center justify-between gap-4 p-4 rounded-2xl border border-line">
          <div>
            <p class="text-[13.5px] font-semibold">Active</p>
            <p class="text-[12px] text-muted">Inactive departments hide their module and assessment from employees.</p>
          </div>
          <Toggle checked={f().active} onChange={set("active")} label="Active" />
        </div>
      </div>
    </Modal>
  );
}
