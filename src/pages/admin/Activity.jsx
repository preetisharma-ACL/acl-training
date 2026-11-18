// Admin · Activity log: who did what, and when, across the portal: records
// created, edited and deleted (with each field's old → new value),
// sign-ins, and employees' tests. Opened from a record's "History" menu it
// shows just that record (?entityType=…&entityId=…&label=…).

import { createResource, createSignal, createEffect, on, onCleanup, For, Show } from "solid-js";
import { History, X, ChevronDown, ArrowRight, Monitor, Globe, Info } from "lucide-solid";
import { query, navigate } from "../../lib/router";
import { cx, fmtDate, fmtDateTime, fmtRelative } from "../../lib/format";
import { listActivity, listActivityActors } from "../../services/admin";
import { describe, changeList, notes, createdWith, KINDS, AREA_OPTIONS } from "../../lib/activity";
import { PageHeader, SearchInput, Skeleton, Avatar, EmptyState, Toggle } from "../../components/ui";

const TYPES = [
  ["", "All activity"],
  ["created", "Created"],
  ["updated", "Edited"],
  ["deleted", "Deleted"],
  ["access", "Sign-ins & passwords"],
  ["tests", "Tests"],
  ["views", "Page views"],
];

const dayKey = (iso) => new Date(iso).toDateString();
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return fmtDate(iso);
}
const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export default function Activity() {
  const record = () => {
    const q = query();
    return q.get("entityId") ? { entityType: q.get("entityType"), entityId: q.get("entityId"), label: q.get("label") } : null;
  };
  const [actors] = createResource(listActivityActors);
  const [search, setSearch] = createSignal("");
  const [q, setQ] = createSignal("");
  const [actorId, setActorId] = createSignal(query().get("actorId") ?? "");
  const [area, setArea] = createSignal("");
  const [kind, setKind] = createSignal("");
  const [from, setFrom] = createSignal("");
  const [to, setTo] = createSignal("");
  const [views, setViews] = createSignal(false);

  // Search waits for a pause in typing.
  let timer;
  createEffect(on(search, (v) => {
    clearTimeout(timer);
    timer = setTimeout(() => setQ(v.trim()), 300);
  }));
  onCleanup(() => clearTimeout(timer));

  const filters = () => ({
    q: q() || undefined,
    actorId: actorId() || undefined,
    entityType: record()?.entityType ?? (area() || undefined),
    entityId: record()?.entityId,
    kind: kind() || undefined,
    views: views() || record() ? "true" : undefined,
    // Local days (the server adds a day to `to`, so it covers the whole day).
    from: from() ? new Date(`${from()}T00:00`).toISOString() : undefined,
    to: to() ? new Date(`${to()}T00:00`).toISOString() : undefined,
  });

  const [items, setItems] = createSignal(null);
  const [cursor, setCursor] = createSignal(null);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [error, setError] = createSignal(null);
  let request = 0;
  createEffect(
    on(filters, async (f) => {
      const mine = ++request;
      setItems(null);
      setError(null);
      try {
        const r = await listActivity(f);
        if (mine !== request) return;
        setItems(r.items);
        setCursor(r.nextCursor);
      } catch (e) {
        if (mine === request) setError(e.message);
      }
    }),
  );
  const more = async () => {
    const mine = request;
    setLoadingMore(true);
    try {
      const r = await listActivity({ ...filters(), cursor: cursor() });
      if (mine !== request) return;
      setItems([...items(), ...r.items]);
      setCursor(r.nextCursor);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = () => !!(q() || actorId() || area() || kind() || from() || to() || views());
  const clearFilters = () => {
    setSearch("");
    setQ("");
    setActorId("");
    setArea("");
    setKind("");
    setFrom("");
    setTo("");
    setViews(false);
  };

  // Items grouped by day, newest first.
  const days = () => {
    const out = [];
    for (const it of items() ?? []) {
      const k = dayKey(it.at);
      if (out.at(-1)?.key !== k) out.push({ key: k, label: dayLabel(it.at), items: [] });
      out.at(-1).items.push(it);
    }
    return out;
  };

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="Insights"
        title="Activity log"
        subtitle="Who did what, and when: records created, edited and deleted (with what changed), sign-ins and tests. Kept permanently."
      />

      <section class="card overflow-hidden">
        <Show
          when={record()}
          fallback={
            <div class="grid gap-3 p-4 border-b border-line">
              <div class="flex flex-wrap items-center gap-3">
                <SearchInput class="flex-1 min-w-[220px]" placeholder="Search a name, title or email…" value={search()} onInput={setSearch} aria-label="Search activity" />
                <select class="input !w-auto min-w-[170px]" value={actorId()} onChange={(e) => setActorId(e.currentTarget.value)} aria-label="Done by">
                  <option value="">Anyone</option>
                  <For each={actors()}>{(a) => <option value={a.id}>{a.name}{a.role === "admin" ? " (admin)" : ""}</option>}</For>
                </select>
                <select class="input !w-auto min-w-[160px]" value={area()} onChange={(e) => setArea(e.currentTarget.value)} aria-label="Area">
                  <option value="">All areas</option>
                  <For each={AREA_OPTIONS}>{([v, l]) => <option value={v}>{l}</option>}</For>
                </select>
                <select class="input !w-auto min-w-[170px]" value={kind()} onChange={(e) => setKind(e.currentTarget.value)} aria-label="Type of activity">
                  <For each={TYPES}>{([v, l]) => <option value={v}>{l}</option>}</For>
                </select>
              </div>
              <div class="flex flex-wrap items-center gap-3 text-[13.5px]">
                <label class="flex items-center gap-2 text-ink-2">
                  From <input type="date" class="input !h-9 !w-auto" value={from()} max={to() || undefined} onChange={(e) => setFrom(e.currentTarget.value)} />
                </label>
                <label class="flex items-center gap-2 text-ink-2">
                  To <input type="date" class="input !h-9 !w-auto" value={to()} min={from() || undefined} onChange={(e) => setTo(e.currentTarget.value)} />
                </label>
                <Show when={!kind()}>
                  <label class="flex items-center gap-2 font-medium text-ink-2">
                    <Toggle checked={views()} onChange={setViews} label="Include page views" /> Include page views
                  </label>
                </Show>
                <Show when={filtered()}>
                  <button class="ml-auto inline-flex items-center gap-1 font-semibold text-plum-700 dark:text-lime-300" onClick={clearFilters}>
                    <X size={13} /> Clear filters
                  </button>
                </Show>
              </div>
            </div>
          }
        >
          <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line bg-plum-50/60 dark:bg-plum-400/10 text-[14px]">
            <History size={15} class="text-muted" />
            History of <strong class="break-words">{record().label || "this record"}</strong>
            <button class="ml-1 inline-flex items-center gap-1 font-semibold text-plum-700 dark:text-lime-300" onClick={() => navigate("/admin/activity", { replace: true })}>
              <X size={13} /> Show all activity
            </button>
          </div>
        </Show>

        <Show when={!error()} fallback={<p class="p-4 error-text !mt-0">{error()}</p>}>
          <Show when={items()} fallback={<div class="p-4 grid gap-2"><For each={[1, 2, 3, 4, 5, 6]}>{() => <Skeleton class="h-14" />}</For></div>}>
            <Show
              when={items().length}
              fallback={
                <EmptyState icon={<History size={24} />} title={record() || filtered() ? "Nothing matches" : "No activity yet"}>
                  {record() ? "Nothing has been recorded for this record yet." : filtered() ? "Adjust or clear the filters to see more." : "Changes, sign-ins and tests will appear here as they happen."}
                </EmptyState>
              }
            >
              <For each={days()}>
                {(d) => (
                  <div>
                    <h2 class="sticky top-0 z-[1] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted bg-sunken/90 backdrop-blur border-b border-line">{d.label}</h2>
                    <ol class="divide-y divide-line">
                      <For each={d.items}>{(it) => <Entry it={it} />}</For>
                    </ol>
                  </div>
                )}
              </For>
              <Show when={cursor()}>
                <div class="p-4 border-t border-line flex justify-center">
                  <button class="btn btn-secondary btn-sm" onClick={more} disabled={loadingMore()}>
                    {loadingMore() ? "Loading…" : "Load older activity"}
                  </button>
                </div>
              </Show>
            </Show>
          </Show>
        </Show>
      </section>
    </div>
  );
}

function Entry(props) {
  const [open, setOpen] = createSignal(false);
  const it = props.it;
  const d = describe(it);
  const changes = changeList(it);
  const extra = notes(it);
  const created = createdWith(it);
  const kind = KINDS[it.kind] ?? KINDS.updated;

  return (
    <li>
      <button class="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3.5 text-left hover:bg-sunken/50 transition" onClick={() => setOpen(!open())} aria-expanded={open()}>
        <Avatar name={d.who ?? "?"} size={34} />
        <span class="min-w-0">
          <span class="block text-[14.5px] leading-snug break-words">
            <strong class="font-semibold">{d.who ?? "System"}</strong>
            <Show when={it.actor?.deleted}>
              <span class="text-muted"> (account deleted)</span>
            </Show>{" "}
            {d.verb}
            <Show when={d.target}>
              {" "}
              <strong class="font-semibold">{d.target}</strong>
            </Show>
          </span>
          <Show when={changes.length}>
            <span class="mt-1.5 grid gap-1">
              <For each={changes.slice(0, open() ? undefined : 3)}>
                {(c) => (
                  <span class="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
                    <span class="text-muted">{c.label}:</span>
                    <span class="line-through decoration-ink/30 text-ink-2 break-words">{c.from}</span>
                    <ArrowRight size={12} class="shrink-0 self-center text-muted" />
                    <span class="font-medium break-words">{c.to}</span>
                  </span>
                )}
              </For>
              <Show when={!open() && changes.length > 3}>
                <span class="text-[12.5px] text-muted">+{changes.length - 3} more change{changes.length - 3 === 1 ? "" : "s"}</span>
              </Show>
            </span>
          </Show>
          <Show when={extra.length}>
            <span class="mt-1 block text-[13px] text-ink-2">{extra.join(" · ")}</span>
          </Show>
        </span>
        <span class="flex flex-col items-end gap-1.5 shrink-0">
          <span class="text-[12.5px] text-muted tabular whitespace-nowrap" title={fmtDateTime(it.at)}>
            {timeOf(it.at)}
          </span>
          <span class={cx("badge", kind.tone)}>{kind.label}</span>
          <ChevronDown size={14} class={cx("text-muted transition", open() && "rotate-180")} />
        </span>
      </button>

      <Show when={open()}>
        <div class="mx-4 mb-4 ml-[62px] grid gap-3 p-3.5 rounded-xl bg-sunken/60 text-[13px]">
          <Show when={created.length}>
            <div>
              <p class="font-semibold mb-1">Created with</p>
              <dl class="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                <For each={created}>
                  {(f) => (
                    <div class="flex gap-1.5 min-w-0">
                      <dt class="text-muted shrink-0">{f.label}:</dt>
                      <dd class="break-words min-w-0">{f.value}</dd>
                    </div>
                  )}
                </For>
              </dl>
            </div>
          </Show>
          <div class="flex flex-wrap gap-x-5 gap-y-1.5 text-ink-2">
            <span>
              {fmtDateTime(it.at)} <span class="text-muted">({fmtRelative(it.at)})</span>
            </span>
            <Show when={it.actor?.email}>
              <span>{it.actor.email}</span>
            </Show>
            <Show when={it.device}>
              <span class="inline-flex items-center gap-1.5">
                <Monitor size={13} class="text-muted" /> {it.device}
              </span>
            </Show>
            <Show when={it.ip}>
              <span class="inline-flex items-center gap-1.5">
                <Globe size={13} class="text-muted" /> IP {it.ip}
              </span>
            </Show>
          </div>
          <Show when={it.kind === "updated" && !changes.length && !extra.length}>
            <p class="flex items-center gap-1.5 text-muted">
              <Info size={13} /> Saved without changing any field (or recorded before field-level tracking was added).
            </p>
          </Show>
          <Show when={it.entityId && it.entityType && !["Attempt"].includes(it.entityType)}>
            <button
              class="justify-self-start inline-flex items-center gap-1.5 font-semibold text-plum-700 dark:text-lime-300"
              onClick={() => navigate(`/admin/activity?entityType=${it.entityType}&entityId=${encodeURIComponent(it.entityId)}&label=${encodeURIComponent(it.label ?? "")}`)}
            >
              <History size={13} /> Full history of this {it.entityType === "Material" ? "material" : it.entityType === "Course" ? "course" : it.entityType.toLowerCase()}
            </button>
          </Show>
        </div>
      </Show>
    </li>
  );
}
