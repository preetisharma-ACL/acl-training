// Admin · Employee results: every attempt, filterable and exportable, with a
// detail drawer showing the full answer review where one was recorded.

import { createResource, createSignal, createMemo, For, Show } from "solid-js";
import { Download, TriangleAlert, ArrowUpDown, ArrowDown, ArrowUp, ChartColumn, Clock, Target, BadgeCheck, X, Info, CircleCheck, CircleX, Trash2 } from "lucide-solid";
import { query, navigate } from "../../lib/router";
import { cx, fmtDateTime, fmtDate, fmtDuration } from "../../lib/format";
import { exportCsv } from "../../lib/csv";
import { listResults, getResult, listDepartments, deleteResult } from "../../services/admin";
import { toast } from "../../store/toast";
import { PageHeader, SearchInput, Tabs, Skeleton, Avatar, Drawer, EmptyState, ProgressRing, Toggle, ConfirmDialog } from "../../components/ui";

const LETTERS = ["A", "B", "C", "D"];
const RANGES = { 7: "7 days", 30: "30 days", 90: "90 days", all: "All time" };

// An attempt is "flagged" at this many focus warnings (times the employee
// left the test page). Same threshold as the server's dashboard KPI.
const FOCUS_FLAG_AT = 2;

export default function Results() {
  const [results, { refetch }] = createResource(listResults);
  const [departments] = createResource(listDepartments);
  const [q, setQ] = createSignal("");
  const [dept, setDept] = createSignal("");
  const [outcome, setOutcome] = createSignal("all");
  const [range, setRange] = createSignal("all");
  const [flagged, setFlagged] = createSignal(false);
  const [sort, setSort] = createSignal({ key: "submittedAt", dir: -1 });
  const [open, setOpen] = createSignal(null);
  const [removing, setRemoving] = createSignal(null);
  const userFilter = () => query().get("user");

  const filtered = createMemo(() => {
    const t = q().trim().toLowerCase();
    const since = range() === "all" ? 0 : Date.now() - Number(range()) * 86400000;
    const { key, dir } = sort();
    return (results() ?? [])
      .filter(
        (r) =>
          (!userFilter() || r.userId === userFilter()) &&
          (!dept() || r.departmentId === dept()) &&
          (outcome() === "all" || (outcome() === "passed" ? r.passed : !r.passed)) &&
          (!flagged() || r.focusViolations >= FOCUS_FLAG_AT) &&
          new Date(r.submittedAt).getTime() >= since &&
          (!t || r.userName.toLowerCase().includes(t) || r.userEmail.toLowerCase().includes(t) || r.userCode.toLowerCase().includes(t)),
      )
      .sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * dir);
  });

  const summary = () => {
    const r = filtered();
    const n = r.length || 1;
    return {
      count: r.length,
      passRate: Math.round((r.filter((x) => x.passed).length / n) * 100),
      avg: Math.round(r.reduce((t, x) => t + x.percentage, 0) / n),
      time: Math.round(r.reduce((t, x) => t + x.timeTakenSeconds, 0) / n),
      flags: r.filter((x) => x.focusViolations >= FOCUS_FLAG_AT).length,
      warned: r.filter((x) => x.focusViolations > 0).length,
    };
  };

  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }));
  const SortIcon = (p) => (
    <Show when={sort().key === p.k} fallback={<ArrowUpDown size={12} class="opacity-40" />}>
      <Show when={sort().dir === 1} fallback={<ArrowDown size={12} />}>
        <ArrowUp size={12} />
      </Show>
    </Show>
  );

  const doExport = () =>
    exportCsv(
      `aajneeti-results-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { label: "Employee code", value: (r) => r.userCode },
        { label: "Employee", value: (r) => r.userName },
        { label: "Email", value: (r) => r.userEmail },
        { label: "Department", value: (r) => r.departmentName },
        { label: "Designation", value: (r) => r.designation },
        { label: "Submitted", value: (r) => r.submittedAt },
        { label: "Score %", value: (r) => r.percentage },
        { label: "Marks", value: (r) => `${r.marks}/${r.totalMarks}` },
        { label: "Correct", value: (r) => r.correct },
        { label: "Incorrect", value: (r) => r.incorrect },
        { label: "Not attempted", value: (r) => r.unanswered },
        { label: "Time taken (s)", value: (r) => r.timeTakenSeconds },
        { label: "Focus warnings", value: (r) => r.focusViolations },
        { label: "Auto-submitted", value: (r) => (r.autoSubmitted ? "yes" : "no") },
        { label: "Result", value: (r) => (r.passed ? "Passed" : "Failed") },
      ],
      filtered(),
    );

  const userName = () => results()?.find((r) => r.userId === userFilter())?.userName;

  return (
    <div class="grid gap-6">
      <PageHeader
        kicker="Insights"
        title="Employee results"
        subtitle="Every assessment attempt across the company. Click a row for the full breakdown."
        actions={
          <button class="btn btn-primary" onClick={doExport} disabled={!filtered().length}>
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <For
          each={[
            [ChartColumn, "Attempts", summary().count],
            [BadgeCheck, "Pass rate", `${summary().passRate}%`],
            [Target, "Average score", `${summary().avg}%`],
            [Clock, "Average time", fmtDuration(summary().time)],
            [TriangleAlert, `Flagged (${FOCUS_FLAG_AT}+ warnings)`, summary().flags],
          ]}
        >
          {([Icon, label, value], i) => (
            <div class={cx("card px-4 py-3.5", i() === 4 && "col-span-2 lg:col-span-1")}>
              <p class="flex items-center gap-1.5 text-[13px] text-muted">
                <Icon size={13} /> {label}
              </p>
              <p class="mt-1 text-[22px] font-semibold tabular tracking-[-0.02em]">{results() ? value : "—"}</p>
            </div>
          )}
        </For>
      </div>

      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-line">
          <SearchInput class="flex-1 min-w-[200px]" placeholder="Search employee, email or code…" value={q()} onInput={setQ} />
          <select class="input !w-auto min-w-[170px]" value={dept()} onChange={(e) => setDept(e.currentTarget.value)} aria-label="Department">
            <option value="">All departments</option>
            <For each={departments()}>{(d) => <option value={d.id}>{d.name}</option>}</For>
          </select>
          <select class="input !w-auto" value={range()} onChange={(e) => setRange(e.currentTarget.value)} aria-label="Date range">
            <For each={Object.entries(RANGES)}>{([k, l]) => <option value={k}>{l}</option>}</For>
          </select>
          <Tabs
            value={outcome()}
            onChange={setOutcome}
            tabs={[
              { id: "all", label: "All" },
              { id: "passed", label: "Passed" },
              { id: "failed", label: "Failed" },
            ]}
          />
          <label class="flex items-center gap-2 text-[13.5px] font-medium text-ink-2">
            <Toggle checked={flagged()} onChange={setFlagged} label={`Only attempts with ${FOCUS_FLAG_AT} or more focus warnings`} /> Flagged only ({FOCUS_FLAG_AT}+)
          </label>
        </div>
        <Show when={userFilter()}>
          <div class="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-plum-50/60 dark:bg-plum-400/10 text-[13.5px]">
            Showing results for <strong>{userName() ?? "this employee"}</strong>
            <button class="ml-1 inline-flex items-center gap-1 font-semibold text-plum-700 dark:text-lime-300" onClick={() => navigate("/admin/results", { replace: true })}>
              <X size={13} /> Clear
            </button>
          </div>
        </Show>

        <Show when={results()} fallback={<div class="p-4 grid gap-2"><For each={[1, 2, 3, 4, 5]}>{() => <Skeleton class="h-12" />}</For></div>}>
          <Show when={filtered().length} fallback={<EmptyState icon={<ChartColumn size={24} />} title="No results match">Adjust the filters to see more attempts.</EmptyState>}>
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>
                      <button class="inline-flex items-center gap-1" onClick={() => sortBy("userName")}>
                        Employee <SortIcon k="userName" />
                      </button>
                    </th>
                    <th>Department</th>
                    <th>
                      <button class="inline-flex items-center gap-1" onClick={() => sortBy("submittedAt")}>
                        Submitted <SortIcon k="submittedAt" />
                      </button>
                    </th>
                    <th>
                      <button class="inline-flex items-center gap-1" onClick={() => sortBy("percentage")}>
                        Score <SortIcon k="percentage" />
                      </button>
                    </th>
                    <th>
                      <button class="inline-flex items-center gap-1" onClick={() => sortBy("timeTakenSeconds")}>
                        Time <SortIcon k="timeTakenSeconds" />
                      </button>
                    </th>
                    <th>Focus</th>
                    <th>Result</th>
                    <th class="w-12" />
                  </tr>
                </thead>
                <tbody>
                  <For each={filtered().slice(0, 100)}>
                    {(r) => (
                      <tr class="cursor-pointer" onClick={() => setOpen(r.id)}>
                        <td>
                          <span class="flex items-center gap-2.5">
                            <Avatar name={r.userName} size={32} />
                            <span>
                              <span class="block font-semibold whitespace-nowrap">{r.userName}</span>
                              <span class="block text-[12.5px] text-muted whitespace-nowrap">{r.designation}</span>
                            </span>
                          </span>
                        </td>
                        <td class="whitespace-nowrap text-ink-2">{r.departmentName}</td>
                        <td class="whitespace-nowrap text-muted">{fmtDateTime(r.submittedAt)}</td>
                        <td class="min-w-[150px]">
                          <div class="flex items-center gap-2.5">
                            <span class="w-11 font-semibold tabular">{r.percentage}%</span>
                            <span class="relative flex-1 h-1.5 rounded-full bg-sunken">
                              <span
                                class={cx("absolute inset-y-0 left-0 rounded-full", r.passed ? "bg-plum-500 dark:bg-lime-400" : "bg-crimson-400")}
                                style={{ width: `${r.percentage}%` }}
                              />
                              <span class="absolute -top-1 -bottom-1 w-px bg-ink/30" style={{ left: `${r.passPercent}%` }} title={`Pass mark ${r.passPercent}%`} />
                            </span>
                          </div>
                        </td>
                        <td class="whitespace-nowrap tabular text-ink-2">
                          {fmtDuration(r.timeTakenSeconds)}
                          <Show when={r.autoSubmitted}>
                            <span class="ml-1.5 badge badge-neutral">auto</span>
                          </Show>
                        </td>
                        <td>
                          <Show when={r.focusViolations} fallback={<span class="text-muted">—</span>}>
                            <span
                              class={cx("badge", r.focusViolations >= FOCUS_FLAG_AT ? "badge-danger" : "badge-warn")}
                              title={`${r.focusViolations} focus warning${r.focusViolations === 1 ? "" : "s"}${r.focusViolations >= FOCUS_FLAG_AT ? " — flagged" : ""}`}
                            >
                              <TriangleAlert size={11} /> {r.focusViolations}
                            </span>
                          </Show>
                        </td>
                        <td>
                          <span class={cx("badge", r.passed ? "badge-success" : "badge-danger")}>{r.passed ? "Passed" : "Failed"}</span>
                        </td>
                        <td>
                          <button
                            class="btn btn-ghost btn-icon !w-8 !h-8 hover:!text-crimson-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemoving(r);
                            }}
                            aria-label={`Delete ${r.userName}'s result`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <Show when={filtered().length > 100}>
              <p class="px-4 py-3 border-t border-line text-[13.5px] text-muted">Showing the first 100 of {filtered().length}. Export to CSV for everything.</p>
            </Show>
          </Show>
        </Show>
      </section>

      <Show when={open()}>
        <ResultDrawer id={open()} onClose={() => setOpen(null)} />
      </Show>
      <Show when={removing()}>
        <ConfirmDialog
          title={`Delete this result for ${removing().userName}?`}
          message={`The ${removing().percentage}% attempt from ${fmtDateTime(removing().submittedAt)} and its answers are deleted permanently. It no longer counts towards their best score, standing or attempts used.`}
          confirmLabel="Delete result"
          tone="danger"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try {
              await deleteResult(removing().id);
              toast("Result deleted.");
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

function ResultDrawer(props) {
  const [r] = createResource(() => props.id, getResult);
  return (
    <Drawer kicker="Attempt detail" title={r()?.userName ?? "Loading…"} subtitle={r() ? `${r().departmentName} · ${fmtDateTime(r().submittedAt)}` : ""} onClose={props.onClose} width="max-w-[600px]">
      <Show when={r()} fallback={<Skeleton class="h-64" />}>
        <div class="grid gap-5">
          <div class="flex items-center gap-5 p-5 rounded-2xl hero-aurora-soft grain text-white relative overflow-hidden">
            <ProgressRing value={r().percentage} size={104} stroke={9} tone={r().passed ? "lime" : "danger"} trackClass="stroke-white/10">
              <span class="text-[22px] font-semibold tabular">{r().percentage}%</span>
            </ProgressRing>
            <div class="relative z-[1]">
              <span class={cx("badge", r().passed ? "bg-lime-400 text-plum-950" : "bg-crimson-500 text-white")}>{r().passed ? "Passed" : "Failed"}</span>
              <p class="mt-2 text-[16px] font-semibold">
                {r().marks}/{r().totalMarks} marks · pass {r().passPercent}%
              </p>
              <p class="text-[13.5px] text-white/60">
                {r().designation} · {r().userEmail}
              </p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2.5">
            <For
              each={[
                [CircleCheck, "Correct", r().correct],
                [CircleX, "Incorrect", r().incorrect],
                ["—", "Skipped", r().unanswered],
                [Clock, "Time", fmtDuration(r().timeTakenSeconds)],
                [TriangleAlert, "Focus warnings", r().focusViolations],
                ["", "Submitted", r().autoSubmitted ? "Auto" : "Manual"],
              ]}
            >
              {([, l, v]) => (
                <div class="p-3 rounded-xl bg-sunken/60">
                  <p class="text-[12.5px] text-muted">{l}</p>
                  <p class="text-[16px] font-semibold tabular">{v}</p>
                </div>
              )}
            </For>
          </div>
          <div>
            <p class="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted mb-3">Answer review</p>
            <Show
              when={r().review}
              fallback={
                <p class="flex items-start gap-2.5 p-3.5 rounded-xl bg-sunken/60 text-[13.5px] text-muted">
                  <Info size={15} class="shrink-0 mt-0.5" /> Imported attempt from {fmtDate(r().submittedAt)} — only summary scores were recorded.
                </p>
              }
            >
              <ol class="grid gap-2.5">
                <For each={r().review}>
                  {(it, i) => (
                    <li class="p-3.5 rounded-xl border border-line">
                      <p class="flex items-start gap-2 text-[14px] font-semibold">
                        <span class={cx("shrink-0 mt-0.5", it.isCorrect ? "text-emerald-600" : it.chosen === null ? "text-muted" : "text-crimson-600")}>
                          <Show when={it.isCorrect} fallback={<CircleX size={15} />}>
                            <CircleCheck size={15} />
                          </Show>
                        </span>
                        {i() + 1}. {it.text}
                      </p>
                      <p class="mt-1.5 pl-6 text-[13.5px] text-muted">
                        Answer: <span class={cx("font-medium", it.isCorrect ? "text-emerald-700 dark:text-emerald-300" : "text-ink-2")}>{it.chosen === null ? "Not attempted" : `${LETTERS[it.chosen]}. ${it.options[it.chosen]}`}</span>
                        <Show when={!it.isCorrect}>
                          {" "}· Correct: <span class="font-medium text-emerald-700 dark:text-emerald-300">{LETTERS[it.correctIndex]}. {it.options[it.correctIndex]}</span>
                        </Show>
                      </p>
                    </li>
                  )}
                </For>
              </ol>
            </Show>
          </div>
        </div>
      </Show>
    </Drawer>
  );
}

