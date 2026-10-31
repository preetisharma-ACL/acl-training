// Admin · Users: every employee and admin, their training status, and the
// add/edit drawer. An employee's department is never chosen here — it follows
// from the designation, exactly as the backend will resolve it.

import { createResource, createSignal, createMemo, For, Show, onMount } from "solid-js";
import {
  UserPlus,
  Download,
  Ellipsis,
  Pencil,
  KeyRound,
  RotateCcw,
  Ban,
  CircleCheck,
  ChartColumn,
  Users as UsersIcon,
  ShieldCheck,
  UserRoundX,
  ChevronLeft,
  ChevronRight,
  Info,
  Eye,
  EyeOff,
  Wand,
  Trash2,
} from "lucide-solid";
import { navigate, query } from "../../lib/router";
import { cx, fmtDate, fmtRelative } from "../../lib/format";
import { exportCsv } from "../../lib/csv";
import { toast } from "../../store/toast";
import { user as me } from "../../store/auth";
import { listUsers, listDesignations, listLocations, saveUser, setUserStatus, resetUserPassword, resetUserAttempts, deleteUser } from "../../services/admin";
import { PageHeader, SearchInput, Tabs, Avatar, Menu, MenuItem, Drawer, Field, Toggle, ConfirmDialog, EmptyState, Skeleton } from "../../components/ui";
import TempPasswordModal from "../../components/TempPasswordModal";
import LocationSelect from "../../components/LocationSelect";
import { phoneProblem } from "../../lib/phone";
import { paginate } from "../../lib/paginate";
import { STATUS_LABELS } from "../../components/status";

const PAGE = 10;

export default function Users() {
  const [users, { refetch }] = createResource(listUsers);
  const [designations] = createResource(listDesignations);
  const [q, setQ] = createSignal(query().get("q") || "");
  const [role, setRole] = createSignal("employee");
  const [dept, setDept] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [page, setPage] = createSignal(0);
  const [editing, setEditing] = createSignal(null); // user row, or {} for new
  const [confirm, setConfirm] = createSignal(null);

  onMount(() => query().get("new") && setEditing({}));

  const departments = createMemo(() => {
    const map = new Map();
    for (const u of users() ?? []) if (u.departmentId) map.set(u.departmentId, u.departmentName);
    return [...map.entries()];
  });

  const filtered = createMemo(() => {
    const term = q().trim().toLowerCase();
    return (users() ?? []).filter(
      (u) =>
        (role() === "all" || u.role === role()) &&
        (!dept() || u.departmentId === dept()) &&
        (!status() || (status() === "inactive" ? u.status === "inactive" : u.trainingStatus === status())) &&
        (!term || [u.name, u.email, u.code, u.designation].some((v) => v?.toLowerCase().includes(term))),
    );
  });
  const view = createMemo(() => paginate(filtered(), page(), PAGE));
  const pages = () => view().pages;
  const rows = () => view().rows;
  const counts = () => {
    const all = users() ?? [];
    return {
      all: all.length,
      employee: all.filter((u) => u.role === "employee").length,
      admin: all.filter((u) => u.role === "admin").length,
      inactive: all.filter((u) => u.status === "inactive").length,
    };
  };
  const reset = (fn) => (v) => {
    fn(v);
    setPage(0);
  };

  const exportRows = () =>
    exportCsv(
      `aajneeti-users-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { label: "Code", value: (u) => u.code },
        { label: "Name", value: (u) => u.name },
        { label: "Email", value: (u) => u.email },
        { label: "Role", value: (u) => u.role },
        { label: "Designation", value: (u) => u.designation ?? "" },
        { label: "Department", value: (u) => u.departmentName ?? "" },
        { label: "Training status", value: (u) => STATUS_LABELS[u.trainingStatus]?.[0] ?? "" },
        { label: "Required materials done", value: (u) => `${u.materialsDone}/${u.materialsRequired}` },
        { label: "Attempts", value: (u) => u.attempts },
        { label: "Best score %", value: (u) => u.bestScore ?? "" },
        { label: "Account", value: (u) => u.status },
      ],
      filtered(),
    );

  // Temporary password from a reset, shown once.
  const [issued, setIssued] = createSignal(null);
  const resetPassword = async (u) => {
    try {
      const r = await resetUserPassword(u.id);
      if (r?.temporaryPassword) setIssued({ name: u.name, email: u.email, password: r.temporaryPassword });
      else toast(`${u.name}'s password has been reset.`);
      refetch();
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };

  const act = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      refetch();
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="People"
        title="Users"
        subtitle="Employees sign in with their work email. Their department and training module follow automatically from their designation."
        actions={
          <>
            <button class="btn btn-secondary" onClick={exportRows} disabled={!filtered().length}>
              <Download size={15} /> Export CSV
            </button>
            <button class="btn btn-primary" onClick={() => setEditing({})}>
              <UserPlus size={15} /> Add user
            </button>
          </>
        }
      />

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <For
          each={[
            [UsersIcon, "Total users", counts().all, "plum"],
            [CircleCheck, "Employees", counts().employee, "lime"],
            [ShieldCheck, "Administrators", counts().admin, "plum"],
            [UserRoundX, "Inactive", counts().inactive, "neutral"],
          ]}
        >
          {([Icon, label, value, tone]) => (
            <div class="card px-4 py-3.5 flex items-center gap-3">
              <span class={cx("grid place-items-center w-10 h-10 rounded-xl", tone === "lime" ? "badge-lime" : tone === "neutral" ? "bg-sunken text-ink-2" : "badge-plum")}>
                <Icon size={18} />
              </span>
              <div>
                <p class="text-[20px] leading-none font-semibold tabular">{users() ? value : "—"}</p>
                <p class="mt-1 text-[13px] text-muted">{label}</p>
              </div>
            </div>
          )}
        </For>
      </div>

      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-line">
          <Tabs
            value={role()}
            onChange={reset(setRole)}
            tabs={[
              { id: "employee", label: "Employees", count: counts().employee },
              { id: "admin", label: "Admins", count: counts().admin },
              { id: "all", label: "All", count: counts().all },
            ]}
          />
          <SearchInput class="flex-1 min-w-[200px]" placeholder="Search name, email, code…" value={q()} onInput={reset(setQ)} />
          <select class="input !w-auto min-w-[170px]" value={dept()} onChange={(e) => reset(setDept)(e.currentTarget.value)} aria-label="Filter by department">
            <option value="">All departments</option>
            <For each={departments()}>{([id, name]) => <option value={id}>{name}</option>}</For>
          </select>
          <select class="input !w-auto min-w-[160px]" value={status()} onChange={(e) => reset(setStatus)(e.currentTarget.value)} aria-label="Filter by status">
            <option value="">Any status</option>
            <For each={Object.entries(STATUS_LABELS)}>{([k, [l]]) => <option value={k}>{l}</option>}</For>
            <option value="inactive">Inactive account</option>
          </select>
        </div>

        <Show when={users()} fallback={<div class="p-4 grid gap-2"><For each={[1, 2, 3, 4, 5]}>{() => <Skeleton class="h-12" />}</For></div>}>
          <Show
            when={filtered().length}
            fallback={
              <EmptyState icon={<UsersIcon size={24} />} title="No users match" action={<button class="btn btn-secondary btn-sm" onClick={() => { setQ(""); setDept(""); setStatus(""); setRole("all"); setPage(0); }}>Clear filters</button>}>
                Try a different search or filter.
              </EmptyState>
            }
          >
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Designation · Department</th>
                    <th>Training</th>
                    <th class="!text-right">Best</th>
                    <th>Last active</th>
                    <th class="w-12" />
                  </tr>
                </thead>
                <tbody>
                  <For each={rows()}>
                    {(u) => (
                      <tr class={cx(u.status === "inactive" && "opacity-60")}>
                        <td>
                          <button class="flex items-center gap-3 text-left" onClick={() => setEditing(u)}>
                            <Avatar name={u.name} size={36} status={u.status} />
                            <span class="min-w-0">
                              <span class="flex items-center gap-1.5 font-semibold whitespace-nowrap hover:text-plum-700 dark:hover:text-lime-300">
                                {u.name}
                                <Show when={u.role === "admin"}>
                                  <span class="badge badge-lime">Admin</span>
                                </Show>
                                <Show when={u.resetRequestedAt}>
                                  <span class="badge badge-warn" title={`Asked for a password reset ${fmtRelative(u.resetRequestedAt)}`}>
                                    Reset requested
                                  </span>
                                </Show>
                              </span>
                              <span class="block text-[13px] text-muted whitespace-nowrap">
                                {u.email} · {u.code}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td class="whitespace-nowrap">
                          <Show when={u.role === "employee"} fallback={<span class="text-ink-2">{u.adminTitle}</span>}>
                            <span class="block font-medium text-ink-2">{u.designation ?? "—"}</span>
                            <span class="block text-[13px] text-muted">{u.departmentName ?? "Unmapped designation"}</span>
                          </Show>
                        </td>
                        <td>
                          <Show when={u.role === "employee"} fallback={<span class="text-muted">—</span>}>
                            <span class={cx("badge", STATUS_LABELS[u.trainingStatus][1])}>{STATUS_LABELS[u.trainingStatus][0]}</span>
                          </Show>
                        </td>
                        <td class="text-right font-semibold tabular">{u.bestScore != null ? `${u.bestScore}%` : <span class="text-muted font-normal">—</span>}</td>
                        <td class="whitespace-nowrap text-muted">{fmtRelative(u.lastActiveAt)}</td>
                        <td>
                          <Menu
                            trigger={(open, toggle) => (
                              <button class={cx("btn btn-ghost btn-icon !w-9 !h-9", open() && "bg-sunken")} onClick={toggle} aria-label={`Actions for ${u.name}`}>
                                <Ellipsis size={17} />
                              </button>
                            )}
                          >
                            <MenuItem icon={<Pencil size={15} />} onClick={() => setEditing(u)}>
                              Edit details
                            </MenuItem>
                            <Show when={u.role === "employee"}>
                              <MenuItem icon={<ChartColumn size={15} />} onClick={() => navigate(`/admin/results?user=${u.id}`)}>
                                View results
                              </MenuItem>
                              <MenuItem
                                icon={<RotateCcw size={15} />}
                                onClick={() =>
                                  setConfirm({
                                    title: `Reset attempts for ${u.name}?`,
                                    message: "Their assessment history is cleared and they can sit the assessment again with a full set of attempts.",
                                    label: "Reset attempts",
                                    run: () => act(() => resetUserAttempts(u.id), `${u.name} can retake the assessment.`),
                                  })
                                }
                              >
                                Reset attempts
                              </MenuItem>
                            </Show>
                            <MenuItem icon={<KeyRound size={15} />} onClick={() => resetPassword(u)}>
                              Reset password
                            </MenuItem>
                            <Show
                              when={u.status === "active"}
                              fallback={
                                <MenuItem icon={<CircleCheck size={15} />} onClick={() => act(() => setUserStatus(u.id, "active"), `${u.name} has been reactivated.`)}>
                                  Reactivate
                                </MenuItem>
                              }
                            >
                              <MenuItem
                                icon={<Ban size={15} />}
                                danger
                                onClick={() =>
                                  setConfirm({
                                    title: `Deactivate ${u.name}?`,
                                    message: "They won't be able to sign in. Their results are kept and you can reactivate them at any time.",
                                    label: "Deactivate",
                                    danger: true,
                                    run: () => act(() => setUserStatus(u.id, "inactive"), `${u.name} has been deactivated.`),
                                  })
                                }
                              >
                                Deactivate
                              </MenuItem>
                            </Show>
                            <Show when={u.id !== me()?.id && (!u.isSuperAdmin || me()?.isSuperAdmin)}>
                              <MenuItem
                                icon={<Trash2 size={15} />}
                                danger
                                onClick={() =>
                                  setConfirm({
                                    title: `Delete ${u.name}?`,
                                    message:
                                      u.role === "employee"
                                        ? `This permanently deletes the account and all of their assessment results${u.attempts ? ` (${u.attempts} attempt${u.attempts === 1 ? "" : "s"})` : ""} and training progress. It can't be undone — deactivate instead to keep their history.`
                                        : "This permanently deletes the admin account. It can't be undone — deactivate instead to keep it.",
                                    label: "Delete permanently",
                                    danger: true,
                                    run: () => act(() => deleteUser(u.id), `${u.name} has been deleted.`),
                                  })
                                }
                              >
                                Delete user
                              </MenuItem>
                            </Show>
                          </Menu>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line text-[13.5px] text-muted">
              <span>
                Showing <strong class="text-ink">{view().from}</strong>–<strong class="text-ink">{view().to}</strong> of{" "}
                <strong class="text-ink">{filtered().length}</strong>
              </span>
              <div class="flex items-center gap-1.5">
                <button class="btn btn-secondary btn-sm btn-icon !w-8 !h-8" disabled={view().page === 0} onClick={() => setPage(view().page - 1)} aria-label="Previous page">
                  <ChevronLeft size={15} />
                </button>
                <span class="px-2 tabular">
                  {view().page + 1} / {pages()}
                </span>
                <button class="btn btn-secondary btn-sm btn-icon !w-8 !h-8" disabled={view().page >= pages() - 1} onClick={() => setPage(view().page + 1)} aria-label="Next page">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </Show>
        </Show>
      </section>

      <Show when={issued()}>
        <TempPasswordModal issued={issued()} onClose={() => setIssued(null)} />
      </Show>
      <Show when={editing()}>
        <UserDrawer
          user={editing()}
          designations={designations() ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      </Show>
      <Show when={confirm()}>
        <ConfirmDialog
          title={confirm().title}
          message={confirm().message}
          confirmLabel={confirm().label}
          tone={confirm().danger ? "danger" : undefined}
          onConfirm={confirm().run}
          onClose={() => setConfirm(null)}
        />
      </Show>
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function UserDrawer(props) {
  const isNew = !props.user.id;
  const [f, setF] = createSignal({
    id: props.user.id,
    name: props.user.name ?? "",
    email: props.user.email ?? "",
    phone: props.user.phone ?? "",
    location: props.user.location ?? "",
    role: props.user.role ?? "employee",
    designationId: props.user.designationId ?? "",
    adminTitle: props.user.adminTitle ?? "Training Admin",
    status: props.user.status ?? "active",
    password: "",
  });
  const [showPw, setShowPw] = createSignal(isNew);
  const generate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setF({ ...f(), password: `${pw}@${Math.floor(Math.random() * 90 + 10)}` });
    setShowPw(true);
  };
  const set = (k) => (v) => setF({ ...f(), [k]: v });
  const [touched, setTouched] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(null);

  const derived = () => props.designations.find((d) => d.id === f().designationId);
  const errors = () => ({
    name: f().name.trim().length < 2 ? "Enter the full name." : null,
    email: !EMAIL_RE.test(f().email.trim()) ? "Enter a valid work email." : null,
    password:
      isNew && !f().password
        ? "Set a password."
        : f().password && f().password.length < 8
          ? "Use at least 8 characters."
          : null,
    designationId: f().role === "employee" && !f().designationId ? "Choose a designation." : null,
    phone: phoneProblem(f().phone),
  });
  const valid = () => !Object.values(errors()).some(Boolean);

  const grouped = createMemo(() => {
    const g = new Map();
    for (const d of props.designations) {
      const k = d.departmentName ?? "Unmapped";
      g.set(k, [...(g.get(k) ?? []), d]);
    }
    return [...g.entries()];
  });

  const save = async () => {
    setTouched(true);
    setError(null);
    if (!valid()) return;
    setBusy(true);
    try {
      await saveUser(f());
      toast(isNew ? `${f().name} can now sign in with ${f().email.trim()}.` : f().password ? "User details and password saved." : "User details saved.", { title: isNew ? "User created" : undefined });
      props.onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Drawer
      kicker={isNew ? "New user" : "Edit user"}
      title={isNew ? "Add a user" : props.user.name}
      subtitle={isNew ? "Set their sign-in email and password, then share them with the user." : `${props.user.code} · joined ${fmtDate(props.user.joinedAt)}`}
      onClose={() => !busy() && props.onClose()}
      footer={
        <>
          <button class="btn btn-secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={save} disabled={busy()}>
            {busy() ? "Saving…" : isNew ? "Create user" : "Save changes"}
          </button>
        </>
      }
    >
      <div class="grid gap-5">
        <Show when={error()}>
          <p class="px-3.5 py-2.5 rounded-xl text-[14px] font-medium badge-danger !flex">{error()}</p>
        </Show>
        <div>
          <p class="label">Role</p>
          <Tabs
            value={f().role}
            onChange={set("role")}
            tabs={[
              { id: "employee", label: "Employee" },
              { id: "admin", label: "Administrator" },
            ]}
          />
        </div>
        <Field label="Full name" for="u-name" error={touched() && errors().name}>
          <input id="u-name" class={cx("input", touched() && errors().name && "input-invalid")} value={f().name} onInput={(e) => set("name")(e.currentTarget.value)} />
        </Field>
        <Field label="Work email" for="u-email" error={touched() && errors().email} hint="This is what they sign in with.">
          <input id="u-email" type="email" class={cx("input", touched() && errors().email && "input-invalid")} value={f().email} onInput={(e) => set("email")(e.currentTarget.value)} />
        </Field>
        <Field
          label={isNew ? "Password" : "New password"}
          for="u-password"
          error={touched() && errors().password}
          hint={isNew ? "At least 8 characters." : "Leave blank to keep their current password."}
        >
          <div class="flex gap-2">
            <div class="relative flex-1">
              <input
                id="u-password"
                type={showPw() ? "text" : "password"}
                autocomplete="new-password"
                class={cx("input pr-11", touched() && errors().password && "input-invalid")}
                placeholder={isNew ? "" : "••••••••"}
                value={f().password}
                onInput={(e) => set("password")(e.currentTarget.value)}
              />
              <button
                type="button"
                class="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-ink"
                onClick={() => setShowPw(!showPw())}
                aria-label={showPw() ? "Hide password" : "Show password"}
              >
                <Show when={showPw()} fallback={<Eye size={16} />}>
                  <EyeOff size={16} />
                </Show>
              </button>
            </div>
            <button type="button" class="btn btn-secondary shrink-0" onClick={generate}>
              <Wand size={15} /> Generate
            </button>
          </div>
        </Field>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Phone" for="u-phone" optional error={touched() && errors().phone}>
            <input id="u-phone" type="tel" inputmode="tel" maxLength={30} placeholder="+91 98765 43210" class={cx("input", touched() && errors().phone && "input-invalid")} value={f().phone} onInput={(e) => set("phone")(e.currentTarget.value)} />
          </Field>
          <Field label="Location" for="u-loc">
            <LocationSelect id="u-loc" load={listLocations} value={f().location} onChange={set("location")} />
          </Field>
        </div>

        <Show
          when={f().role === "employee"}
          fallback={
            <Field label="Admin title" for="u-title">
              <select id="u-title" class="input" value={f().adminTitle} onChange={(e) => set("adminTitle")(e.currentTarget.value)}>
                <For each={["Super Admin", "HR & Training Admin", "Training Admin"]}>{(t) => <option>{t}</option>}</For>
              </select>
            </Field>
          }
        >
          <Field label="Designation" for="u-des" error={touched() && errors().designationId}>
            <select id="u-des" class={cx("input", touched() && errors().designationId && "input-invalid")} value={f().designationId} onChange={(e) => set("designationId")(e.currentTarget.value)}>
              <option value="">Choose a designation…</option>
              <For each={grouped()}>
                {([dept, list]) => (
                  <optgroup label={dept}>
                    <For each={list}>{(d) => <option value={d.id}>{d.title}</option>}</For>
                  </optgroup>
                )}
              </For>
            </select>
          </Field>
          <div class="flex items-start gap-3 p-3.5 rounded-2xl bg-plum-50/70 dark:bg-plum-400/10 border border-plum-200/60 dark:border-plum-400/20 text-[14px]">
            <Info size={17} class="shrink-0 mt-px text-plum-600 dark:text-plum-200" />
            <p class="text-ink-2">
              <Show when={derived()} fallback="The department is set automatically from the designation.">
                <Show when={derived().departmentName} fallback={<>“{derived().title}” isn't mapped to a department — this user won't get a training module.</>}>
                  Department: <strong class="text-ink">{derived().departmentName}</strong> — set automatically from the designation. Their training module follows.
                </Show>
              </Show>
            </p>
          </div>
        </Show>

        <div class="flex items-center justify-between gap-4 p-4 rounded-2xl border border-line">
          <div>
            <p class="text-[14.5px] font-semibold">Account active</p>
            <p class="text-[13px] text-muted">Inactive users can't sign in.</p>
          </div>
          <Toggle checked={f().status === "active"} onChange={(v) => set("status")(v ? "active" : "inactive")} label="Account active" />
        </div>
      </div>
    </Drawer>
  );
}
