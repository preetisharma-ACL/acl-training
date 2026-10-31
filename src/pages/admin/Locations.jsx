// Admin · Locations: the office list used by every location dropdown
// (users, departments and each person's profile).

import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Pencil, Trash2, MapPin } from "lucide-solid";
import { toast } from "../../store/toast";
import { listLocations, saveLocation, deleteLocation } from "../../services/admin";
import { PageHeader, Skeleton, Modal, Field, ConfirmDialog, EmptyState } from "../../components/ui";

export default function Locations() {
  const [list, { refetch }] = createResource(listLocations);
  const [editing, setEditing] = createSignal(null);
  const [removing, setRemoving] = createSignal(null);

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="People"
        title="Locations"
        subtitle="The offices people and departments can be assigned to. Renaming one updates everyone at that office."
        actions={
          <button class="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={16} /> Add location
          </button>
        }
      />

      <section class="card overflow-hidden">
        <Show when={list()} fallback={<div class="p-4 grid gap-2"><For each={[1, 2, 3]}>{() => <Skeleton class="h-11" />}</For></div>}>
          <Show
            when={list().length}
            fallback={
              <EmptyState icon={<MapPin size={24} />} title="No locations yet" action={<button class="btn btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add location</button>}>
                Add your offices so they can be picked for people and departments.
              </EmptyState>
            }
          >
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th class="!text-right">People</th>
                    <th class="!text-right">Departments</th>
                    <th class="w-24" />
                  </tr>
                </thead>
                <tbody>
                  <For each={list()}>
                    {(l) => (
                      <tr>
                        <td class="font-semibold whitespace-nowrap">
                          <span class="inline-flex items-center gap-2.5">
                            <span class="grid place-items-center w-7 h-7 rounded-lg badge-plum !p-0">
                              <MapPin size={14} />
                            </span>
                            {l.name}
                          </span>
                        </td>
                        <td class="text-right tabular">{l.users}</td>
                        <td class="text-right tabular">{l.departments}</td>
                        <td>
                          <div class="flex justify-end gap-1">
                            <button class="btn btn-ghost btn-icon !w-8 !h-8" onClick={() => setEditing(l)} aria-label={`Rename ${l.name}`}>
                              <Pencil size={15} />
                            </button>
                            <button class="btn btn-ghost btn-icon !w-8 !h-8 hover:!text-crimson-600" onClick={() => setRemoving(l)} aria-label={`Delete ${l.name}`}>
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
        </Show>
      </section>

      <Show when={editing()}>
        <LocationModal
          loc={editing()}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      </Show>
      <Show when={removing()}>
        <ConfirmDialog
          title={`Delete “${removing().name}”?`}
          message={
            removing().users || removing().departments
              ? `${removing().name} is still used by ${removing().users} people and ${removing().departments} departments. Move them to another location first.`
              : "It will no longer appear in location lists."
          }
          confirmLabel="Delete"
          tone="danger"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try {
              await deleteLocation(removing().id);
              toast("Location deleted.");
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

function LocationModal(props) {
  const isNew = !props.loc.id;
  const [name, setName] = createSignal(props.loc.name ?? "");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);
  const inUse = () => (props.loc.users ?? 0) + (props.loc.departments ?? 0);

  const save = async (e) => {
    e?.preventDefault();
    if (name().trim().length < 2 || busy()) return;
    setBusy(true);
    setError(null);
    try {
      await saveLocation({ id: props.loc.id, name: name() });
      toast(isNew ? "Location added." : "Location renamed.");
      props.onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Add a location" : `Rename ${props.loc.name}`}
      labelledBy="loc-title"
      size="sm"
      onClose={() => !busy() && props.onClose()}
      footer={
        <>
          <button class="btn btn-secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={save} disabled={name().trim().length < 2 || busy()}>
            {busy() ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form class="grid gap-4" onSubmit={save}>
        <Show when={error()}>
          <p class="px-3.5 py-2.5 rounded-xl text-[14px] font-medium badge-danger !flex">{error()}</p>
        </Show>
        <Field label="Location name" for="loc-name" hint={!isNew && inUse() ? `${props.loc.users} people and ${props.loc.departments} departments will move to the new name.` : undefined}>
          <input id="loc-name" class="input" maxLength={60} placeholder="e.g. Kolkata" value={name()} onInput={(e) => setName(e.currentTarget.value)} autofocus />
        </Field>
      </form>
    </Modal>
  );
}
