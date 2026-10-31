// Admin overview: organisation-wide training health at a glance.

import { createResource, createSignal, For, Show } from "solid-js";
import {
  ArrowRight,
  Megaphone,
  TriangleAlert,
  Sparkles,
  Library,
  ClipboardList,
  UserPlus,
  Crown,
  KeyRound,
} from "lucide-solid";
import { Link, navigate } from "../../lib/router";
import { cx, fmtRelative, greeting } from "../../lib/format";
import { user } from "../../store/auth";
import { toast } from "../../store/toast";
import { getOverview, postAnnouncement, resetUserPassword } from "../../services/admin";
import TempPasswordModal from "../../components/TempPasswordModal";
import { Skeleton, SectionTitle, Avatar, Modal, Field } from "../../components/ui";
import { ColumnChart } from "../../components/charts";
import { DeptIcon } from "../../components/icons";
import { STATUS_LABELS } from "../../components/status";

export default function Overview() {
  const [data, { refetch }] = createResource(getOverview);
  const [announce, setAnnounce] = createSignal(false);
  const [issued, setIssued] = createSignal(null);
  const [resetting, setResetting] = createSignal(null);

  const resetPassword = async (r) => {
    setResetting(r.userId);
    try {
      const res = await resetUserPassword(r.userId);
      setIssued({ name: r.name, email: r.email, password: res.temporaryPassword });
      refetch();
    } catch (e) {
      toast(e.message, { tone: "error" });
    } finally {
      setResetting(null);
    }
  };

  return (
    <div class="grid gap-6">
      {/* Welcome */}
      <section class="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p class="kicker">
            <Sparkles size={13} /> {greeting()} · {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 class="mt-2 text-[28px] sm:text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">Welcome back, {user().name.split(" ")[0]}.</h1>
          <p class="mt-2 text-[15.5px] text-muted">Manage people, training material and assessments for the whole team.</p>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <button class="btn btn-primary" onClick={() => setAnnounce(true)}>
            <Megaphone size={16} /> Post announcement
          </button>
          <button class="btn btn-secondary" onClick={() => navigate("/admin/users?new=1")}>
            <UserPlus size={16} /> Add employee
          </button>
          <button class="btn btn-secondary" onClick={() => navigate("/admin/materials?new=1")}>
            <Library size={16} /> Upload material
          </button>
        </div>
      </section>

      {/* "Forgot password" requests waiting for an admin */}
      <Show when={data()?.resetRequests?.length}>
        <section class="card p-5 sm:p-6 border-amber-300/70 dark:border-amber-400/30">
          <SectionTitle
            title="Password reset requests"
            subtitle="These people used “Forgot password?”. Reset it, then share the temporary password with them."
            action={<span class="badge badge-warn">{data().resetRequests.length} waiting</span>}
          />
          <ul class="mt-4 grid gap-2">
            <For each={data().resetRequests}>
              {(r) => (
                <li class="flex flex-wrap items-center gap-3 p-2.5 rounded-xl border border-line">
                  <Avatar name={r.name} size={34} />
                  <span class="flex-1 min-w-[180px]">
                    <span class="block text-[14px] font-semibold truncate">{r.name}</span>
                    <span class="block text-[12.5px] text-muted truncate">
                      {r.email}
                      {r.designation ? ` · ${r.designation}` : ""} · asked {fmtRelative(r.requestedAt)}
                    </span>
                  </span>
                  <button class="btn btn-primary btn-sm" disabled={resetting() === r.userId} onClick={() => resetPassword(r)}>
                    <KeyRound size={14} /> {resetting() === r.userId ? "Resetting…" : "Reset password"}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <section class="card p-5 sm:p-6">
        <SectionTitle
          title="Latest attempts"
          subtitle="Across all departments"
          action={
            <Link href="/admin/results" class="btn btn-secondary btn-sm">
              <ClipboardList size={14} /> All results
            </Link>
          }
        />
        <div class="mt-4 -mx-5 sm:-mx-6 overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th class="!pl-5 sm:!pl-6">Employee</th>
                <th>Department</th>
                <th class="!text-right">Score</th>
                <th>Result</th>
                <th>Focus</th>
                <th class="!pr-5 sm:!pr-6">When</th>
              </tr>
            </thead>
            <tbody>
              <For each={data()?.recent}>
                {(a) => (
                  <tr>
                    <td class="!pl-5 sm:!pl-6">
                      <span class="flex items-center gap-2.5">
                        <Avatar name={a.userName} size={30} />
                        <span class="font-semibold whitespace-nowrap">{a.userName}</span>
                      </span>
                    </td>
                    <td class="whitespace-nowrap text-ink-2">{a.departmentName}</td>
                    <td class="text-right font-semibold tabular">{a.percentage}%</td>
                    <td>
                      <span class={cx("badge", a.passed ? "badge-success" : "badge-danger")}>{a.passed ? "Passed" : "Failed"}</span>
                    </td>
                    <td>
                      <Show when={a.focusViolations} fallback={<span class="text-muted">—</span>}>
                        <span class="badge badge-warn">
                          <TriangleAlert size={11} /> {a.focusViolations}
                        </span>
                      </Show>
                    </td>
                    <td class="!pr-5 sm:!pr-6 whitespace-nowrap text-muted">{fmtRelative(a.submittedAt)}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
          <Show when={data() && !data().recent.length}>
            <p class="px-6 py-10 text-center text-[14px] text-muted">No attempts yet. They'll appear here as employees finish their assessments.</p>
          </Show>
        </div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section class="card p-5 sm:p-6">
          <SectionTitle title="Top performers" subtitle="Best score per employee" action={<Crown size={18} class="text-lime-600 dark:text-lime-300" />} />
          <ol class="mt-4 grid gap-1">
            <For
              each={data()?.topPerformers}
              fallback={data() ? <p class="py-8 text-center text-[14px] text-muted">No scores yet.</p> : <Skeleton class="h-[220px]" />}
            >
              {(p, i) => (
                <li class="flex items-center gap-3 p-2 rounded-xl hover:bg-sunken/60">
                  <span
                    class={cx(
                      "w-6 text-center text-[13px] font-semibold tabular",
                      i() === 0 ? "text-lime-700 dark:text-lime-300" : "text-muted",
                    )}
                  >
                    {i() + 1}
                  </span>
                  <Avatar name={p.name} size={34} />
                  <span class="flex-1 min-w-0">
                    <span class="block text-[14px] font-semibold truncate">{p.name}</span>
                    <span class="block text-[12.5px] text-muted truncate">{p.designation}</span>
                  </span>
                  <span class="text-[15px] font-semibold tabular">{p.bestScore}%</span>
                </li>
              )}
            </For>
          </ol>
        </section>

        <section class="card p-5 sm:p-6">
          <SectionTitle
            title="Needs attention"
            subtitle="Not started, or failed and not yet passed"
            action={
              <Link href="/admin/users" class="btn btn-ghost btn-sm">
                All users <ArrowRight size={14} />
              </Link>
            }
          />
          <ul class="mt-4 grid gap-2">
            <For each={data()?.attention} fallback={<p class="py-8 text-center text-[14px] text-muted">Everyone is on track.</p>}>
              {(p) => (
                <li class="flex items-center gap-3 p-2.5 rounded-xl border border-line">
                  <Avatar name={p.name} size={34} />
                  <span class="flex-1 min-w-0">
                    <span class="block text-[14px] font-semibold truncate">{p.name}</span>
                    <span class="flex items-center gap-1.5 text-[12.5px] text-muted truncate">
                      <DeptIcon id={p.departmentId} size={11} /> {p.departmentName}
                    </span>
                  </span>
                  <span class={cx("badge", STATUS_LABELS[p.trainingStatus][1])}>{STATUS_LABELS[p.trainingStatus][0]}</span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </div>

      <section class="card p-5 sm:p-6">
        <SectionTitle
          title="Performance by department"
          subtitle="Average assessment score · dashed line is the pass mark · hover a bar for pass rate and certifications"
          action={
            <Link href="/admin/results" class="btn btn-ghost btn-sm">
              Results <ArrowRight size={14} />
            </Link>
          }
        />
        <div class="mt-6">
          <Show when={data()} fallback={<Skeleton class="h-[260px]" />}>
            <Show
              when={data().departments.some((d) => d.avgScore > 0)}
              fallback={<p class="py-16 text-center text-[14px] text-muted">No assessment results yet — the chart fills in as employees take their tests.</p>}
            >
            <ColumnChart
              ariaLabel="Average assessment score by department"
              xLabel="Department"
              yLabel="Average score (%)"
              width={1100}
              height={260}
              barWidth={54}
              max={100}
              ticks={[0, 25, 50, 75, 100]}
              reference={70}
              referenceLabel="Pass mark 70%"
              format={(v) => `${v}%`}
              data={data().departments.map((d) => ({
                label: d.name,
                short: d.name.split(" (")[0],
                value: d.avgScore,
                tooltip: `avg ${d.avgScore}% · ${d.passRate}% pass rate · ${d.certified}/${d.employees} certified`,
              }))}
            />
            </Show>
          </Show>
        </div>
      </section>

      <Show when={issued()}>
        <TempPasswordModal issued={issued()} onClose={() => setIssued(null)} />
      </Show>
      <Show when={announce()}>
        <AnnounceModal onClose={() => setAnnounce(false)} />
      </Show>
    </div>
  );
}

function AnnounceModal(props) {
  const [title, setTitle] = createSignal("");
  const [body, setBody] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const ok = () => title().trim().length >= 4 && body().trim().length >= 10;
  const send = async () => {
    setBusy(true);
    await postAnnouncement({ title: title().trim(), body: body().trim(), author: user().name });
    toast("Announcement posted to every employee dashboard.", { title: "Published" });
    props.onClose();
  };
  return (
    <Modal
      title="Post an announcement"
      subtitle="Shown on every employee's dashboard and in their notifications."
      labelledBy="announce-title"
      onClose={() => !busy() && props.onClose()}
      footer={
        <>
          <button class="btn btn-secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button class="btn btn-primary" disabled={!ok() || busy()} onClick={send}>
            <Megaphone size={15} /> {busy() ? "Posting…" : "Publish"}
          </button>
        </>
      }
    >
      <div class="grid gap-4">
        <Field label="Title" for="an-title">
          <input id="an-title" class="input" placeholder="e.g. November training cycle is open" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
        </Field>
        <Field label="Message" for="an-body" hint={`${body().length}/280`}>
          <textarea id="an-body" rows="4" maxlength="280" class="input resize-none" value={body()} onInput={(e) => setBody(e.currentTarget.value)} />
        </Field>
      </div>
    </Modal>
  );
}

