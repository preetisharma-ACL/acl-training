// Course player (Study Materials → a course), laid out like Udemy: the video
// on the left, "Course content" (sections → videos, with progress) on the
// right, stacked on phones. Videos are unlisted YouTube videos played in the
// embedded player; employees stay in the portal.
//
// Tracking: the player is sampled every second (lib/watch.js) and a
// heartbeat with the watched ranges goes to the server every 10 s while
// playing, and on pause, end, switching video and leaving the page. The
// server credits it (capped to real time) and decides completion (90%).

import { createResource, createSignal, createEffect, onMount, onCleanup, For, Show, batch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { ArrowLeft, ChevronDown, CircleCheck, PlayCircle, Circle, SkipForward, SkipBack, Trophy, MonitorPlay, TriangleAlert } from "lucide-solid";
import { Link, navigate, query } from "../../lib/router";
import { cx } from "../../lib/format";
import { toast } from "../../store/toast";
import { getMyCourse, saveLessonProgress } from "../../services/training";
import { loadYouTubeApi, clock, totalLength } from "../../lib/youtube";
import { createWatchTracker } from "../../lib/watch";
import { ProgressRing, Skeleton, EmptyState } from "../../components/ui";

const HEARTBEAT_MS = 10000;
const NEXT_COUNTDOWN = 5;
const EMBED_ERRORS = {
  2: "This video link isn't valid. Ask your training admin to check it.",
  5: "This video can't be played in your browser.",
  100: "This video was removed or made private on YouTube. Ask your training admin.",
  101: "Playback inside the portal is turned off for this video on YouTube. Ask your training admin to allow embedding.",
  150: "Playback inside the portal is turned off for this video on YouTube. Ask your training admin to allow embedding.",
};

export default function CoursePlayer(props) {
  const [data] = createResource(() => props.params.id, getMyCourse);
  const [course, setCourse] = createStore({ sections: [] });
  createEffect(() => data() && setCourse(reconcile(structuredClone(data()))));

  const lessons = () => course.sections.flatMap((s, si) => s.lessons.map((l, li) => ({ ...l, si, li })));
  const [currentId, setCurrentId] = createSignal(null);
  const current = () => lessons().find((l) => l.id === currentId());
  const index = () => lessons().findIndex((l) => l.id === currentId());
  const next = () => lessons()[index() + 1];
  const prev = () => lessons()[index() - 1];

  // First video: ?lesson=…, else the first one not completed.
  createEffect(() => {
    if (!data() || currentId()) return;
    const all = lessons();
    const wanted = query().get("lesson");
    setCurrentId((all.find((l) => l.id === wanted) ?? all.find((l) => !l.progress.completed) ?? all[0])?.id ?? null);
  });

  // Updates one video's progress and the course totals from a server reply.
  const apply = (lessonId, reply) => {
    if (!reply?.lesson) return;
    const before = lessons().find((l) => l.id === lessonId)?.progress;
    batch(() => {
      course.sections.forEach((s, si) => s.lessons.forEach((l, li) => l.id === lessonId && setCourse("sections", si, "lessons", li, "progress", reply.lesson.progress)));
      for (const [k, v] of Object.entries(reply.course)) setCourse(k, v);
      course.sections.forEach((s, si) => setCourse("sections", si, "completed", s.lessons.filter((l) => l.progress.completed).length));
    });
    if (reply.lesson.progress.completed && !before?.completed) {
      toast(reply.course.completed ? "You've finished every video in this course." : "Video complete.", { title: reply.course.completed ? "Course complete" : reply.lesson.title });
    }
  };

  // ── Player ──
  let host;
  let player;
  let loadedId = null;
  const tracker = createWatchTracker();
  const [playerError, setPlayerError] = createSignal(null);
  const [upNext, setUpNext] = createSignal(null); // seconds left, or null
  let countdown;

  const send = async (lessonId, body = {}) => {
    try {
      apply(lessonId, await saveLessonProgress(lessonId, body));
    } catch {
      /* offline or signed out: the next heartbeat catches up */
    }
  };
  const flush = () => {
    if (!loadedId || !player?.getCurrentTime) return;
    const ranges = tracker.drain();
    send(loadedId, { ...(ranges.length ? { ranges } : {}), position: Math.round(player.getCurrentTime() || 0) });
  };

  const startPosition = (l) => (l.progress.completed || l.progress.position >= l.durationSeconds - 5 ? 0 : l.progress.position);

  const show = (l, autoplay) => {
    if (!player || !l) return;
    if (loadedId && loadedId !== l.id) flush();
    tracker.reset();
    setPlayerError(null);
    loadedId = l.id;
    const opts = { videoId: l.youtubeId, startSeconds: startPosition(l) };
    autoplay ? player.loadVideoById(opts) : player.cueVideoById(opts);
    send(l.id); // records "opened"
  };

  onMount(async () => {
    let YT;
    try {
      YT = await loadYouTubeApi();
    } catch (e) {
      setPlayerError(e.message);
      return;
    }
    // Wait until the course (and the first video) is known.
    const ready = () =>
      new Promise((resolve) => {
        const check = () => (current() && host ? resolve() : setTimeout(check, 50));
        check();
      });
    await ready();
    const first = current();
    player = new YT.Player(host, {
      host: "https://www.youtube-nocookie.com",
      width: "100%",
      height: "100%",
      videoId: first.youtubeId,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: startPosition(first), origin: window.location.origin },
      events: {
        onReady: () => {
          loadedId = first.id;
          send(first.id);
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) flush();
          if (e.data === YT.PlayerState.ENDED && next()) startCountdown();
          if (e.data === YT.PlayerState.PLAYING) cancelCountdown();
        },
        onError: (e) => setPlayerError(EMBED_ERRORS[e.data] ?? "This video can't be played right now."),
      },
    });
  });

  // Sampling and heartbeats.
  onMount(() => {
    const sampler = setInterval(() => {
      if (!player?.getPlayerState) return;
      tracker.sample(player.getCurrentTime(), player.getPlayerState() === 1);
    }, 1000);
    const beat = setInterval(() => player?.getPlayerState?.() === 1 && flush(), HEARTBEAT_MS);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    onCleanup(() => {
      clearInterval(sampler);
      clearInterval(beat);
      document.removeEventListener("visibilitychange", onHide);
      cancelCountdown();
      // Last heartbeat, then tear the player down. YouTube's destroy() can
      // throw once the page has already removed its iframe.
      try {
        flush();
      } catch {
        /* player already gone */
      }
      const p = player;
      player = null;
      try {
        p?.destroy?.();
      } catch {
        /* ignore */
      }
    });
  });

  const select = (l, autoplay = true) => {
    cancelCountdown();
    setCurrentId(l.id);
    navigate(`/courses/${props.params.id}?lesson=${l.id}`, { replace: true });
    show(l, autoplay);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function startCountdown() {
    cancelCountdown();
    setUpNext(NEXT_COUNTDOWN);
    countdown = setInterval(() => {
      const n = upNext() - 1;
      if (n <= 0) {
        cancelCountdown();
        if (next()) select(next());
      } else setUpNext(n);
    }, 1000);
  }
  function cancelCountdown() {
    clearInterval(countdown);
    countdown = null;
    setUpNext(null);
  }

  return (
    <Show
      when={!data.error}
      fallback={
        <div class="card">
          <EmptyState
            icon={<MonitorPlay size={24} />}
            title="Course unavailable"
            action={
              <Link href="/courses" class="btn btn-secondary">
                <ArrowLeft size={15} /> Study Materials
              </Link>
            }
          >
            {data.error?.message}
          </EmptyState>
        </div>
      }
    >
      <div class="grid gap-4">
        {/* Course bar */}
        <header class="flex items-center gap-3 px-3 sm:px-5 py-3 rounded-2xl bg-plum-950 text-white">
          <Link href="/courses" class="grid place-items-center w-9 h-9 rounded-lg hover:bg-white/10 shrink-0" aria-label="Back to Study Materials">
            <ArrowLeft size={18} />
          </Link>
          <div class="min-w-0 flex-1">
            <p class="text-[12px] uppercase tracking-[0.14em] text-white/50">Study Materials</p>
            <h1 class="text-[15px] sm:text-[17px] font-semibold truncate !text-white">{course.title ?? "Loading…"}</h1>
          </div>
          <Show when={data()}>
            <div class="flex items-center gap-2.5 shrink-0">
              <ProgressRing value={course.percent ?? 0} size={42} stroke={4} tone="lime" trackClass="stroke-white/15">
                <Show when={course.completed} fallback={<span class="text-[11px] font-semibold tabular">{course.percent}%</span>}>
                  <Trophy size={15} class="text-lime-300" />
                </Show>
              </ProgressRing>
              <div class="hidden sm:block text-[12.5px] leading-tight">
                <p class="font-semibold">Your progress</p>
                <p class="text-white/60 tabular">
                  {course.lessonsCompleted} of {course.lessonsTotal} complete
                </p>
              </div>
            </div>
          </Show>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-5 items-start">
          {/* Player + details */}
          <div class="grid gap-4 min-w-0">
            <div class="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-float">
              {/* YouTube swaps this div for its iframe (sized 100% below). */}
              <div class="absolute inset-0">
                <div ref={host} />
              </div>
              <Show when={!data()}>
                <div class="absolute inset-0 skeleton !rounded-none !bg-white/5" />
              </Show>
              <Show when={playerError()}>
                <div class="absolute inset-0 grid place-items-center p-6 bg-black/85 text-center text-white">
                  <div class="max-w-[420px]">
                    <TriangleAlert size={26} class="mx-auto text-amber-300" />
                    <p class="mt-3 text-[15px] leading-relaxed">{playerError()}</p>
                  </div>
                </div>
              </Show>
              <Show when={upNext() != null && next()}>
                <div class="absolute inset-0 grid place-items-center p-6 bg-black/80 text-center text-white">
                  <div>
                    <p class="text-[13px] uppercase tracking-[0.14em] text-white/60">Up next in {upNext()}s</p>
                    <p class="mt-2 text-[17px] font-semibold">{next().title}</p>
                    <div class="mt-4 flex justify-center gap-2">
                      <button class="btn btn-secondary btn-sm" onClick={cancelCountdown}>
                        Cancel
                      </button>
                      <button class="btn btn-lime btn-sm" onClick={() => select(next())}>
                        Play now
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            <Show when={current()} fallback={<Skeleton class="h-[120px] !rounded-2xl" />}>
              <section class="card p-4 sm:p-6">
                <p class="text-[12.5px] text-muted">
                  Section {current().si + 1}: {course.sections[current().si]?.title} · Video {index() + 1} of {lessons().length}
                </p>
                <h2 class="mt-1 text-[19px] sm:text-[21px] font-semibold tracking-[-0.015em]">{current().title}</h2>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                  <span class="badge badge-neutral">{clock(current().durationSeconds)}</span>
                  <Show
                    when={current().progress.completed}
                    fallback={
                      <span class="text-muted">
                        {current().progress.percent ? `${current().progress.percent}% watched` : "Not watched yet"} · counts as complete at 90%
                      </span>
                    }
                  >
                    <span class="badge badge-success">
                      <CircleCheck size={12} /> Completed
                    </span>
                  </Show>
                </div>
                <Show when={current().description}>
                  <p class="mt-3 text-[14.5px] text-ink-2 leading-relaxed whitespace-pre-line">{current().description}</p>
                </Show>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button class="btn btn-secondary btn-sm" disabled={!prev()} onClick={() => select(prev())}>
                    <SkipBack size={14} /> Previous
                  </button>
                  <button class="btn btn-primary btn-sm" disabled={!next()} onClick={() => select(next())}>
                    Next video <SkipForward size={14} />
                  </button>
                </div>
              </section>
            </Show>

            <Show when={course.description}>
              <section class="card p-4 sm:p-6">
                <h3 class="text-[15px] font-semibold">About this course</h3>
                <p class="mt-2 text-[14.5px] text-ink-2 leading-relaxed whitespace-pre-line">{course.description}</p>
                <p class="mt-3 text-[13px] text-muted">
                  {course.lessonsTotal} videos · {totalLength(course.durationSeconds)} · {course.required ? "Required before your test" : "Optional"}
                </p>
              </section>
            </Show>
          </div>

          {/* Course content */}
          <aside class="card overflow-hidden lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-110px)] flex flex-col">
            <div class="px-4 py-3.5 border-b border-line">
              <h2 class="text-[15.5px] font-semibold">Course content</h2>
            </div>
            <Show when={data()} fallback={<div class="p-4 grid gap-2"><For each={[1, 2, 3]}>{() => <Skeleton class="h-14" />}</For></div>}>
              <div class="overflow-y-auto scrollbar-thin">
                <For each={course.sections}>{(s, si) => <SectionBlock s={s} n={si() + 1} currentId={currentId()} open={current()?.si === si()} onSelect={select} />}</For>
              </div>
            </Show>
          </aside>
        </div>
      </div>
    </Show>
  );
}

function SectionBlock(props) {
  const [open, setOpen] = createSignal(props.open);
  createEffect(() => props.open && setOpen(true));
  return (
    <div class="border-b border-line last:border-b-0">
      <button class="w-full flex items-start gap-3 px-4 py-3.5 text-left bg-sunken/50 hover:bg-sunken transition" onClick={() => setOpen(!open())} aria-expanded={open()}>
        <span class="flex-1 min-w-0">
          <span class="block text-[14.5px] font-semibold leading-snug">
            Section {props.n}: {props.s.title}
          </span>
          <span class="block mt-1 text-[12.5px] text-muted tabular">
            {props.s.completed} / {props.s.lessons.length} | {totalLength(props.s.durationSeconds)}
          </span>
        </span>
        <ChevronDown size={17} class={cx("shrink-0 mt-0.5 text-muted transition", open() && "rotate-180")} />
      </button>
      <Show when={open()}>
        <ol>
          <For each={props.s.lessons}>
            {(l, li) => {
              const on = () => props.currentId === l.id;
              return (
                <li>
                  <button
                    class={cx("w-full flex items-start gap-3 px-4 py-3 text-left transition", on() ? "bg-plum-50 dark:bg-lime-400/10" : "hover:bg-sunken/60")}
                    onClick={() => props.onSelect(l)}
                    aria-current={on() ? "true" : undefined}
                  >
                    <span class={cx("shrink-0 mt-0.5", l.progress.completed ? "text-emerald-600 dark:text-emerald-400" : on() ? "text-plum-700 dark:text-lime-300" : "text-muted")}>
                      <Show when={l.progress.completed} fallback={on() ? <PlayCircle size={17} /> : <Circle size={17} />}>
                        <CircleCheck size={17} />
                      </Show>
                    </span>
                    <span class="flex-1 min-w-0">
                      <span class={cx("block text-[14px] leading-snug", on() && "font-semibold")}>
                        {li() + 1}. {l.title}
                      </span>
                      <span class="mt-1 flex items-center gap-2 text-[12.5px] text-muted">
                        <MonitorPlay size={12} /> {clock(l.durationSeconds)}
                        <Show when={!l.progress.completed && l.progress.percent > 0}>
                          <span class="ml-auto tabular">{l.progress.percent}%</span>
                        </Show>
                      </span>
                      <Show when={!l.progress.completed && l.progress.percent > 0}>
                        <span class="mt-1.5 block h-1 rounded-full bg-sunken overflow-hidden">
                          <span class="block h-full bg-plum-500 dark:bg-lime-400" style={{ width: `${l.progress.percent}%` }} />
                        </span>
                      </Show>
                    </span>
                  </button>
                </li>
              );
            }}
          </For>
        </ol>
      </Show>
    </div>
  );
}
