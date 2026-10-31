// Document viewer for all three material types:
//   pdf        → the browser's PDF viewer in a framed preview
//   manual     → a paper-style reader with chapters and a contents rail
//   structured → section cards with key points and tips
// Every type can be downloaded as a PDF. Opening is recorded by the server
// when the material loads; while it's open the viewer sends a heartbeat
// (scroll percent + chapters/sections seen). The SERVER decides completion
// from its own evidence (reading time, sections, PDF actually opened):
// manuals and guides complete themselves once it's met, PDFs and media when
// the reader clicks "Mark as complete", which stays disabled until then.
//
// Also used by admins (/admin/materials/:id) as a read-only preview.

import { createResource, createSignal, createEffect, onCleanup, onMount, For, Show, Switch, Match } from "solid-js";
import { createStore } from "solid-js/store";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  CircleCheck,
  Clock,
  Minus,
  Plus,
  Lightbulb,
  Info,
  TriangleAlert,
  FileText,
  LockOpen,
  Check,
  Printer,
} from "lucide-solid";
import { Link, navigate } from "../../lib/router";
import { cx, fmtDate, fmtBytes } from "../../lib/format";
import { user, isAdmin } from "../../store/auth";
import { toast } from "../../store/toast";
import { getMaterial, getMaterialFile, updateProgress, getMyModule } from "../../services/training";
import { getMaterialForAdmin } from "../../services/admin";
import { Skeleton, ProgressBar, EmptyState } from "../../components/ui";
import { TypeIcon, MATERIAL_TYPES } from "../../components/icons";
import { parseMedia, PROVIDER_LABEL } from "../../lib/media";
import { completionNeeded } from "../../lib/progress";

// Types that are read on the page (scroll progress, text size, print).
const READING = ["manual", "structured"];

const FONT_SIZES = [14, 15, 16, 17, 18, 20];

export default function Viewer(props) {
  const me = user();
  const admin = isAdmin();
  const backHref = admin ? "/admin/materials" : "/training";

  const [doc, { mutate }] = createResource(
    () => props.params.id,
    async (id) => {
      if (!admin) return getMaterial(me, id);
      const m = await getMaterialForAdmin(id);
      if (!m) throw new Error("Material not found.");
      return { ...m, progress: { opened: true, completed: false, percent: 0 } };
    },
  );
  const [mod, { refetch: refetchModule }] = createResource(() => (admin ? null : getMyModule(me)));
  const [file] = createResource(
    () => doc(),
    (d) => getMaterialFile(d),
  );
  const [fontIdx, setFontIdx] = createSignal(2);
  const [readPct, setReadPct] = createSignal(0);
  const [seen, setSeen] = createStore({});
  const [busy, setBusy] = createSignal(false);
  const prog = () => doc()?.progress;
  const tracking = () => !admin && doc() && !prog()?.completed;

  // Reading progress from scroll position (manual + structured).
  onMount(() => {
    const onScroll = () => {
      const el = document.getElementById("doc-body");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      setReadPct(total <= 0 ? 100 : Math.min(100, Math.max(0, ((-r.top + window.innerHeight * 0.25) / total) * 100)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", onScroll));
  });

  // The server's answer is the truth: keep the page in step with it.
  const apply = (p) => {
    if (!p || !doc()) return;
    const was = prog()?.completed;
    mutate({ ...doc(), progress: p });
    if (p.completed && !was) {
      refetchModule();
      toast("Nice work — this material is complete.", { title: doc().title });
    }
  };

  const report = async (extra = {}) => {
    if (!tracking()) return;
    const body = { ...extra };
    if (READING.includes(doc().type)) {
      body.percent = Math.round(readPct());
      const ids = Object.keys(seen).filter((k) => seen[k]);
      if (ids.length) body.seen = ids;
    }
    try {
      apply(await updateProgress(me, doc().id, body));
    } catch (e) {
      if (e.details?.requirement) apply(e.details);
      if (extra.completed) toast(e.message, { tone: "error", title: "Not complete yet" });
    }
  };

  // Heartbeat while the page is visible, and once more when leaving it.
  onMount(() => {
    const t = setInterval(() => document.visibilityState === "visible" && report(), 15000);
    onCleanup(() => {
      clearInterval(t);
      report();
    });
  });

  // Newly seen chapters/sections are reported shortly after (batched).
  let seenTimer;
  const markSeen = (ids) => {
    const fresh = ids.filter((id) => !seen[id]);
    if (!fresh.length) return;
    for (const id of fresh) setSeen(id, true);
    clearTimeout(seenTimer);
    seenTimer = setTimeout(() => report(), 1200);
  };
  onCleanup(() => clearTimeout(seenTimer));

  const complete = async () => {
    if (!tracking() || busy()) return;
    setBusy(true);
    await report({ completed: true });
    setBusy(false);
  };

  // What's still needed before "Mark as complete" unlocks.
  const needed = () => completionNeeded(prog(), doc()?.type);

  const download = () => {
    const f = file();
    if (!f) return;
    const a = document.createElement("a");
    // PDFs: the server's attachment URL (Content-Disposition carries the
    // file name); manuals/guides: the generated blob.
    a.href = f.downloadUrl ?? f.url;
    a.download = f.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(`${f.fileName} is downloading.`, { title: "Download started" });
  };

  const siblings = () => {
    const list = mod()?.materials ?? [];
    const i = list.findIndex((m) => m.id === props.params.id);
    return { prev: list[i - 1], next: list[i + 1], index: i, total: list.length };
  };

  return (
    <div class="grid gap-5">
      {/* Reading progress hairline */}
      <Show when={doc() && READING.includes(doc().type)}>
        <div class="no-print fixed top-0 left-0 right-0 h-[3px] z-[60] pointer-events-none">
          <div class="h-full bg-gradient-to-r from-plum-500 via-plum-400 to-lime-400 transition-[width] duration-150" style={{ width: `${readPct()}%` }} />
        </div>
      </Show>

      <Show
        when={!doc.error}
        fallback={
          <div class="card">
            <EmptyState
              icon={<FileText size={24} />}
              title="Material unavailable"
              action={
                <Link href={backHref} class="btn btn-secondary">
                  <ArrowLeft size={15} /> Back
                </Link>
              }
            >
              {doc.error?.message}
            </EmptyState>
          </div>
        }
      >
        <Show when={doc()} fallback={<ViewerSkeleton />}>
          {/* Toolbar */}
          <header class="card px-3 sm:px-5 py-3 sm:py-4 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-3">
            <Link href={backHref} class="btn btn-ghost btn-icon !w-10 shrink-0" aria-label="Back to module" title="Back">
              <ArrowLeft size={18} />
            </Link>
            <span
              class={cx(
                "hidden sm:grid place-items-center shrink-0 w-11 h-11 rounded-xl",
                doc().type === "pdf"
                  ? "bg-crimson-50 text-crimson-600 dark:bg-crimson-500/15 dark:text-crimson-300"
                  : doc().type === "manual"
                    ? "bg-plum-50 text-plum-700 dark:bg-plum-400/15 dark:text-plum-200"
                    : doc().type === "media"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      : "bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300",
              )}
            >
              <TypeIcon type={doc().type} size={20} />
            </span>
            <div class="min-w-0 flex-1 basis-[220px]">
              <div class="hidden sm:flex items-center gap-2 flex-wrap">
                <span class={cx("badge", MATERIAL_TYPES[doc().type].badge)}>{MATERIAL_TYPES[doc().type].label}</span>
                <Show when={doc().required}>
                  <span class="badge badge-outline">Required</span>
                </Show>
                <Show when={admin}>
                  <span class="badge badge-warn">Admin preview</span>
                </Show>
              </div>
              <h1 class="sm:mt-1.5 text-[17px] sm:text-[19px] font-semibold leading-snug tracking-[-0.015em]">{doc().title}</h1>
              <p class="sm:hidden mt-0.5 text-[13px] text-muted">
                {MATERIAL_TYPES[doc().type].short} · {doc().estMinutes} min
                <Show when={doc().progress.completed && !admin}> · <span class="text-emerald-600 dark:text-emerald-300 font-medium">Done</span></Show>
              </p>
              <p class="hidden sm:block mt-0.5 text-[13px] text-muted">
                v{doc().version} · {doc().author} · Updated {fmtDate(doc().updatedAt)} · <Clock size={11} class="inline -mt-0.5" /> {doc().estMinutes} min
                <Show when={file()?.pages}> · {file().pages} pages</Show>
                <Show when={file()?.sizeBytes}> · {fmtBytes(file().sizeBytes)}</Show>
              </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <Show when={READING.includes(doc().type)}>
                <div class="flex items-center h-9 rounded-lg border border-line bg-surface" role="group" aria-label="Text size">
                  <button class="grid place-items-center w-9 h-full text-muted hover:text-ink disabled:opacity-40" disabled={fontIdx() === 0} onClick={() => setFontIdx(fontIdx() - 1)} aria-label="Smaller text">
                    <Minus size={14} />
                  </button>
                  <span class="px-1.5 text-[13px] font-semibold text-ink-2 tabular select-none">Aa</span>
                  <button class="grid place-items-center w-9 h-full text-muted hover:text-ink disabled:opacity-40" disabled={fontIdx() === FONT_SIZES.length - 1} onClick={() => setFontIdx(fontIdx() + 1)} aria-label="Larger text">
                    <Plus size={14} />
                  </button>
                </div>
              </Show>
              <Show when={doc().type === "pdf" && file()}>
                <a href={file().url} target="_blank" rel="noopener" class="btn btn-secondary btn-sm">
                  <ExternalLink size={14} /> <span class="hidden sm:inline">Open in new tab</span>
                </a>
              </Show>
              <Show when={READING.includes(doc().type)}>
                <button class="btn btn-secondary btn-sm hidden sm:inline-flex" onClick={() => window.print()}>
                  <Printer size={14} /> Print
                </button>
              </Show>
              <Show
                when={doc().type === "media"}
                fallback={
                  <button class="btn btn-secondary btn-sm" onClick={download} disabled={!file()}>
                    <Download size={14} /> Download
                  </button>
                }
              >
                <a href={doc().content?.url} target="_blank" rel="noopener" class="btn btn-secondary btn-sm">
                  <ExternalLink size={14} /> Open link
                </a>
              </Show>
              <Show when={!admin}>
                <span class="hidden sm:contents">
                <Show
                  when={!doc().progress.completed}
                  fallback={
                    <span class="badge badge-success h-9 px-3 rounded-lg text-[13.5px]">
                      <CircleCheck size={14} /> Completed
                    </span>
                  }
                >
                  <button class="btn btn-primary btn-sm" onClick={complete} disabled={!prog()?.canComplete || busy()} title={needed() ? `To complete: ${needed()}` : undefined}>
                    <Check size={14} /> Mark as complete
                  </button>
                </Show>
                </span>
              </Show>
            </div>
          </header>

          <Show when={!admin && needed()}>
            <p class="no-print -mt-2 flex items-center gap-2 px-1 text-[13px] text-muted">
              <Clock size={13} /> To complete: {needed()}
            </p>
          </Show>

          {/* Phones: the main action, pinned above the tab bar. */}
          <Show when={!admin && !doc().progress.completed}>
            <div class="no-print sm:hidden fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 px-4 pb-3 pt-2 bg-gradient-to-t from-canvas via-canvas/95 to-transparent">
              <button class="btn btn-primary btn-lg w-full" onClick={complete} disabled={!prog()?.canComplete || busy()}>
                <Check size={17} /> Mark as complete
              </button>
            </div>
          </Show>

          <div id="doc-body">
            <Switch>
              <Match when={doc().type === "pdf"}>
                <PdfFrame file={file()} title={doc().title} onDownload={download} />
              </Match>
              <Match when={doc().type === "manual"}>
                <ManualReader doc={doc()} fontSize={FONT_SIZES[fontIdx()]} seen={seen} onSeen={markSeen} />
              </Match>
              <Match when={doc().type === "media"}>
                <MediaPlayer doc={doc()} onEnded={complete} />
              </Match>
              <Match when={doc().type === "structured"}>
                <StructuredReader doc={doc()} fontSize={FONT_SIZES[fontIdx()]} seen={seen} onSeen={markSeen} />
              </Match>
            </Switch>
          </div>

          {/* Next steps */}
          <Show when={!admin && mod()}>
            <footer class="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <Show when={siblings().prev}>
                  <Link href={`/training/${siblings().prev.id}`} class="group card card-hover flex items-center gap-3 p-4">
                    <ArrowLeft size={16} class="text-muted group-hover:-translate-x-0.5 transition" />
                    <span class="min-w-0">
                      <span class="block text-[12px] uppercase tracking-[0.12em] text-muted">Previous</span>
                      <span class="block text-[14.5px] font-semibold truncate">{siblings().prev.title}</span>
                    </span>
                  </Link>
                </Show>
              </div>
              <span class="hidden sm:block text-center text-[13px] text-muted tabular">
                {siblings().index + 1} / {siblings().total}
              </span>
              <div>
                <Show
                  when={siblings().next}
                  fallback={
                    <Link href="/training" class="group card card-hover flex items-center justify-end gap-3 p-4 text-right">
                      <span>
                        <span class="block text-[12px] uppercase tracking-[0.12em] text-muted">Done reading?</span>
                        <span class="block text-[14.5px] font-semibold">Back to your module</span>
                      </span>
                      <ArrowRight size={16} class="text-muted group-hover:translate-x-0.5 transition" />
                    </Link>
                  }
                >
                  <Link href={`/training/${siblings().next.id}`} class="group card card-hover flex items-center justify-end gap-3 p-4 text-right">
                    <span class="min-w-0">
                      <span class="block text-[12px] uppercase tracking-[0.12em] text-muted">Next</span>
                      <span class="block text-[14.5px] font-semibold truncate">{siblings().next.title}</span>
                    </span>
                    <ArrowRight size={16} class="text-muted group-hover:translate-x-0.5 transition" />
                  </Link>
                </Show>
              </div>
            </footer>
            <Show when={doc().progress.completed && mod().eligible && !mod().passed && !mod().lastAttempt}>
              <UnlockHint />
            </Show>
          </Show>
        </Show>
      </Show>
      {/* Keeps the last lines clear of the pinned button on phones. */}
      <Show when={!admin && doc() && !doc().progress.completed}>
        <div class="sm:hidden h-16" aria-hidden="true" />
      </Show>
    </div>
  );
}

function UnlockHint() {
  return (
    <div class="no-print flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-lime-100 text-lime-900 dark:bg-lime-400/10 dark:text-lime-200 border border-lime-300/60 dark:border-lime-400/20 animate-fade-up">
      <LockOpen size={18} />
      <p class="flex-1 text-[14.5px] font-medium">All required modules are done — your test is unlocked.</p>
      <button class="btn btn-primary btn-sm" onClick={() => navigate("/test")}>
        Go to test <ArrowRight size={14} />
      </button>
    </div>
  );
}

function ViewerSkeleton() {
  return (
    <>
      <Skeleton class="h-[92px] !rounded-2xl" />
      <div class="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
        <Skeleton class="hidden lg:block h-[320px] !rounded-2xl" />
        <Skeleton class="h-[620px] !rounded-2xl" />
      </div>
    </>
  );
}

// ── PDF ─────────────────────────────────────────────────────────────────────

function PdfFrame(props) {
  return (
    <div class="relative rounded-[22px] p-2 sm:p-3 bg-gradient-to-b from-plum-900 to-plum-950 shadow-float">
      <div class="flex items-center justify-between px-2 pb-2 sm:pb-3 text-[13px] text-white/60">
        <span class="flex items-center gap-2">
          <span class="flex gap-1.5">
            <i class="w-2.5 h-2.5 rounded-full bg-white/20" />
            <i class="w-2.5 h-2.5 rounded-full bg-white/20" />
            <i class="w-2.5 h-2.5 rounded-full bg-lime-400/80" />
          </span>
          <span class="ml-2 truncate max-w-[50vw]">{props.file?.fileName ?? "Loading document…"}</span>
        </span>
        <span class="hidden sm:inline">Scroll inside the document to read</span>
      </div>
      <Show when={props.file} fallback={<div class="skeleton !rounded-xl h-[70vh] !bg-white/5" />}>
        <iframe
          src={`${props.file.url}#toolbar=1&navpanes=0&view=FitH`}
          title={props.title}
          class="w-full h-[calc(100vh-260px)] min-h-[560px] rounded-xl bg-white"
        />
      </Show>
      {/* Phones often can't render PDFs inline. */}
      <div class="sm:hidden flex items-center gap-3 mt-3 p-3 rounded-xl bg-white/10 text-white/80 text-[13.5px]">
        <Info size={16} class="shrink-0 text-lime-300" />
        <span class="flex-1">Preview not showing? Open or download the PDF instead.</span>
        <button class="btn btn-lime btn-sm" onClick={props.onDownload}>
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Video / audio ───────────────────────────────────────────────────────────

function MediaPlayer(props) {
  const m = () => parseMedia(props.doc.content?.url);
  const audio = () => props.doc.content?.kind === "audio";
  return (
    <div class="card overflow-hidden">
      <Switch
        fallback={
          <EmptyState
            icon={<ExternalLink size={24} />}
            title="This link opens outside the portal"
            action={
              <a href={props.doc.content?.url} target="_blank" rel="noopener" class="btn btn-primary">
                <ExternalLink size={15} /> Open link
              </a>
            }
          >
            {props.doc.description || "Open it in a new tab, then come back and mark it complete."}
          </EmptyState>
        }
      >
        <Match when={["youtube", "vimeo", "drive"].includes(m().provider)}>
          <div class={cx("bg-black", audio() ? "aspect-[16/5]" : "aspect-video")}>
            <iframe
              src={m().embed}
              title={props.doc.title}
              class="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            />
          </div>
        </Match>
        <Match when={m().provider === "file" && !audio()}>
          <video src={m().url} controls preload="metadata" class="w-full max-h-[75vh] bg-black" onEnded={props.onEnded} />
        </Match>
        <Match when={m().provider === "file" && audio()}>
          <div class="flex flex-col items-center gap-5 px-6 py-12 bg-gradient-to-br from-plum-50 to-lime-50 dark:from-plum-900/30 dark:to-surface">
            <span class="grid place-items-center w-16 h-16 rounded-2xl bg-surface border border-line text-plum-700 dark:text-lime-300">
              <TypeIcon type="media" size={28} />
            </span>
            <audio src={m().url} controls preload="metadata" class="w-full max-w-[560px]" onEnded={props.onEnded} />
          </div>
        </Match>
      </Switch>
      <Show when={props.doc.description && m().provider !== "link"}>
        <p class="px-5 sm:px-6 py-4 border-t border-line text-[15px] text-ink-2 leading-relaxed">{props.doc.description}</p>
      </Show>
    </div>
  );
}

// ── Shared reader pieces ────────────────────────────────────────────────────

// Scroll-spy for [data-section]. A section counts as seen once its top has
// come into view: checked when the reader opens (so sections already on
// screen count) and on every scroll/resize frame (so a fast scroll or a
// jump from the contents still counts everything scrolled past). The
// server still requires the minimum reading time before completion.
function useSections(ids, onSeen) {
  const [active, setActive] = createSignal(null);
  let frame;
  const check = () => {
    frame = null;
    const vh = window.innerHeight;
    const els = [...document.querySelectorAll("[data-section]")];
    const seenNow = [];
    let current = els[0]?.dataset.section ?? null;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.9) seenNow.push(el.dataset.section);
      if (r.top < vh * 0.35) current = el.dataset.section;
    }
    // At the very bottom, the last section is the current one.
    if (els.length && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = els[els.length - 1].dataset.section;
    setActive(current);
    if (seenNow.length) onSeen?.(seenNow);
  };
  const schedule = () => (frame ??= requestAnimationFrame(check));
  createEffect(() => {
    if (ids().length) queueMicrotask(schedule);
  });
  onMount(() => {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
  });
  onCleanup(() => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (frame) cancelAnimationFrame(frame);
  });
  return active;
}

const jump = (id) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

function Contents(props) {
  return (
    <aside class="hidden lg:block sticky top-[92px] self-start">
      <div class="card p-4">
        <p class="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted mb-3">{props.title ?? "Contents"}</p>
        <Show when={props.progress != null}>
          <ProgressBar value={props.progress} />
          <p class="mt-2 mb-3 text-[12.5px] text-muted">{props.progressLabel}</p>
        </Show>
        <ol class="grid gap-0.5">
          <For each={props.items}>
            {(it, i) => {
              const on = () => props.active === it.id;
              return (
                <li>
                  <button
                    onClick={() => jump(it.id)}
                    class={cx(
                      "relative flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-[13.5px] transition",
                      on() ? "bg-plum-50 text-plum-800 font-semibold dark:bg-lime-400/10 dark:text-lime-200" : "text-ink-2 hover:bg-sunken",
                    )}
                  >
                    <span
                      class={cx(
                        "grid place-items-center shrink-0 w-5 h-5 rounded-full text-[11px] font-bold",
                        props.seen?.[it.id] ? "bg-lime-400 text-plum-950" : "bg-sunken text-muted",
                      )}
                    >
                      <Show when={props.seen?.[it.id]} fallback={i() + 1}>
                        <Check size={11} stroke-width={3} />
                      </Show>
                    </span>
                    <span class="line-clamp-2">{it.title}</span>
                  </button>
                </li>
              );
            }}
          </For>
        </ol>
      </div>
    </aside>
  );
}

// ── Manual ──────────────────────────────────────────────────────────────────

function Block(props) {
  const b = props.b;
  return (
    <Switch>
      <Match when={b.type === "p"}>
        <p>{b.text}</p>
      </Match>
      <Match when={b.type === "h"}>
        <h3>{b.text}</h3>
      </Match>
      <Match when={b.type === "ul"}>
        <ul>
          <For each={b.items}>{(i) => <li>{i}</li>}</For>
        </ul>
      </Match>
      <Match when={b.type === "ol"}>
        <ol>
          <For each={b.items}>{(i) => <li>{i}</li>}</For>
        </ol>
      </Match>
      <Match when={b.type === "callout"}>
        <div
          class={cx(
            "flex gap-3 my-5 p-4 rounded-2xl border",
            b.tone === "warn"
              ? "bg-amber-50 border-amber-200/70 dark:bg-amber-500/10 dark:border-amber-400/20"
              : "bg-plum-50/70 border-plum-200/60 dark:bg-plum-400/10 dark:border-plum-400/20",
          )}
        >
          <span class={cx("shrink-0 mt-0.5", b.tone === "warn" ? "text-amber-600 dark:text-amber-300" : "text-plum-600 dark:text-plum-200")}>
            <Show when={b.tone === "warn"} fallback={<Info size={18} />}>
              <TriangleAlert size={18} />
            </Show>
          </span>
          <div>
            <p class="!mb-1 font-semibold !text-ink">{b.title}</p>
            <p class="!mb-0">{b.text}</p>
          </div>
        </div>
      </Match>
    </Switch>
  );
}

function ManualReader(props) {
  const chapters = () => props.doc.content.chapters;
  const seen = props.seen;
  const active = useSections(() => chapters().map((c) => c.id), props.onSeen);
  const seenCount = () => chapters().filter((c) => seen[c.id]).length;

  return (
    <div class="print-flat grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-6 items-start">
      <Contents
        items={chapters()}
        active={active()}
        seen={seen}
        progress={(seenCount() / chapters().length) * 100}
        progressLabel={`${seenCount()} of ${chapters().length} chapters`}
      />
      <article class="card overflow-hidden" style={{ "font-size": `${props.fontSize}px` }}>
        {/* Title page */}
        <div class="relative px-6 sm:px-14 pt-12 pb-10 border-b border-line bg-gradient-to-br from-plum-50/70 via-surface to-lime-50/60 dark:from-plum-900/40 dark:via-surface dark:to-surface">
          <p class="kicker">{MATERIAL_TYPES.manual.label} · v{props.doc.version}</p>
          <h2 class="mt-3 text-[1.9em] leading-[1.1] font-semibold tracking-[-0.03em] max-w-[640px]">{props.doc.title}</h2>
          <p class="mt-4 text-[1em] text-muted max-w-[620px] leading-relaxed">{props.doc.description}</p>
        </div>
        <div class="px-6 sm:px-14 py-10 max-w-[820px] prose-doc">
          <For each={chapters()}>
            {(ch, i) => (
              <section id={`sec-${ch.id}`} data-section={ch.id} class="scroll-mt-[96px] mb-12 last:mb-4">
                <p class="text-[0.72em] font-semibold uppercase tracking-[0.18em] text-plum-500 dark:text-lime-300">Chapter {String(i() + 1).padStart(2, "0")}</p>
                <h2 class="mt-2 mb-5 text-[1.45em] leading-tight font-semibold tracking-[-0.02em] text-ink">{ch.title}</h2>
                <For each={ch.blocks}>{(b) => <Block b={b} />}</For>
              </section>
            )}
          </For>
          <div class="flex items-center gap-3 pt-6 border-t border-line text-[0.85em] text-muted">
            <CircleCheck size={16} class="text-lime-600 dark:text-lime-300" /> End of document
          </div>
        </div>
      </article>
    </div>
  );
}

// ── Structured guide ────────────────────────────────────────────────────────

function StructuredReader(props) {
  const sections = () => props.doc.content.sections;
  const seen = props.seen;
  const active = useSections(() => sections().map((s) => s.id), props.onSeen);
  const seenCount = () => sections().filter((s) => seen[s.id]).length;

  return (
    <div class="print-flat grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-6 items-start">
      <Contents
        items={sections()}
        active={active()}
        seen={seen}
        progress={(seenCount() / sections().length) * 100}
        progressLabel={`${seenCount()} of ${sections().length} sections read`}
      />
      <article class="grid grid-cols-1 gap-4 min-w-0" style={{ "font-size": `${props.fontSize}px` }}>
        <Show when={props.doc.content.intro}>
          <div class="card p-6 sm:px-9 sm:py-7 bg-gradient-to-br from-plum-50/80 to-surface dark:from-plum-900/40 dark:to-surface">
            <p class="kicker">Introduction</p>
            <p class="mt-3 text-[1.05em] leading-[1.75] text-ink-2 max-w-[760px]">{props.doc.content.intro}</p>
          </div>
        </Show>
        <For each={sections()}>
          {(sec, i) => (
            <section id={`sec-${sec.id}`} data-section={sec.id} class="card p-6 sm:px-9 sm:py-8 scroll-mt-[96px]">
              <div class="flex items-center gap-3 mb-4">
                <span class="grid place-items-center w-9 h-9 rounded-xl bg-plum-700 text-white dark:bg-lime-400 dark:text-plum-950 text-[14px] font-semibold tabular">
                  {String(i() + 1).padStart(2, "0")}
                </span>
                <h2 class="text-[1.3em] font-semibold tracking-[-0.02em]">{sec.title}</h2>
              </div>
              <div class="prose-doc max-w-[780px]">
                <For each={sec.body}>{(p) => <p>{p}</p>}</For>
              </div>
              <Show when={sec.points?.length}>
                <div class="mt-2 p-5 rounded-2xl bg-sunken/60 border border-line/70 max-w-[780px]">
                  <p class="text-[0.72em] font-semibold uppercase tracking-[0.16em] text-muted mb-3">Key points</p>
                  <ul class="grid gap-2.5">
                    <For each={sec.points}>
                      {(pt) => (
                        <li class="flex items-start gap-3 text-ink-2 leading-relaxed">
                          <span class="grid place-items-center shrink-0 w-5 h-5 mt-[0.2em] rounded-full bg-lime-400 text-plum-950">
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
                <div class="flex gap-3 mt-4 p-4 rounded-2xl bg-lime-100/70 dark:bg-lime-400/10 border border-lime-300/60 dark:border-lime-400/20 max-w-[780px]">
                  <Lightbulb size={18} class="shrink-0 mt-0.5 text-lime-700 dark:text-lime-300" />
                  <p class="text-ink-2 leading-relaxed">
                    <strong class="text-ink">Tip · </strong>
                    {sec.tip}
                  </p>
                </div>
              </Show>
            </section>
          )}
        </For>
      </article>
    </div>
  );
}

