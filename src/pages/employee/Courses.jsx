// Study Materials: the video courses assigned to the employee (their
// department and level, plus company-wide), with progress. Required courses
// must be completed before the assessment unlocks.

import { createResource, For, Show } from "solid-js";
import { MonitorPlay, PlayCircle, CircleCheck, Clock, ListVideo } from "lucide-solid";
import { Link } from "../../lib/router";
import { cx } from "../../lib/format";
import { listMyCourses } from "../../services/training";
import { thumbnail, totalLength } from "../../lib/youtube";
import { ProgressBar, Skeleton, EmptyState } from "../../components/ui";

export default function Courses() {
  const [courses] = createResource(listMyCourses);
  const required = () => (courses() ?? []).filter((c) => c.required);
  const requiredLeft = () => required().filter((c) => !c.completed).length;

  return (
    <div class="grid gap-5 max-w-[1100px] mx-auto">
      <div>
        <p class="kicker mb-2">Video courses</p>
        <h1 class="text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em]">Study Materials</h1>
        <p class="mt-1.5 text-[15px] text-muted">Watch each course in order. Your progress is saved as you go.</p>
      </div>

      <Show when={courses() && requiredLeft()}>
        <p class="flex items-start gap-2.5 px-4 py-3 rounded-2xl badge-warn !flex !text-[14px] !font-medium !rounded-2xl">
          <ListVideo size={17} class="shrink-0 mt-0.5" />
          {requiredLeft()} required course{requiredLeft() === 1 ? "" : "s"} to finish before your test unlocks.
        </p>
      </Show>

      <Show when={courses()} fallback={<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"><For each={[1, 2, 3]}>{() => <Skeleton class="h-[300px] !rounded-2xl" />}</For></div>}>
        <Show
          when={courses().length}
          fallback={
            <div class="card">
              <EmptyState icon={<MonitorPlay size={24} />} title="No courses yet">
                Video courses assigned to you will appear here.
              </EmptyState>
            </div>
          }
        >
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            <For each={courses()}>{(c) => <CourseCard c={c} />}</For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

function CourseCard(props) {
  const c = () => props.c;
  const action = () => (c().completed ? "Watch again" : c().started ? "Continue" : "Start course");
  return (
    <Link href={`/courses/${c().id}`} class="group card card-hover overflow-hidden flex flex-col">
      <div class="relative aspect-video bg-plum-950">
        <Show when={c().thumbnail}>
          <img src={thumbnail(c().thumbnail)} alt="" loading="lazy" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" />
        </Show>
        <span class="absolute inset-0 grid place-items-center">
          <span class="grid place-items-center w-14 h-14 rounded-full bg-white/90 text-plum-800 shadow-float group-hover:scale-105 transition">
            <PlayCircle size={30} />
          </span>
        </span>
        <span class={cx("absolute top-3 left-3 badge", c().required ? "bg-crimson-600 text-white" : "bg-white/90 text-ink")}>{c().required ? "Required" : "Optional"}</span>
        <Show when={c().completed}>
          <span class="absolute top-3 right-3 badge bg-emerald-600 text-white">
            <CircleCheck size={12} /> Completed
          </span>
        </Show>
      </div>
      <div class="p-4 sm:p-5 flex flex-col gap-2 flex-1">
        <h2 class="text-[16px] font-semibold leading-snug line-clamp-2">{c().title}</h2>
        <Show when={c().description}>
          <p class="text-[13.5px] text-muted line-clamp-2">{c().description}</p>
        </Show>
        <p class="flex items-center gap-3 text-[13px] text-muted">
          <span class="inline-flex items-center gap-1">
            <ListVideo size={13} /> {c().lessonsTotal} video{c().lessonsTotal === 1 ? "" : "s"}
          </span>
          <span class="inline-flex items-center gap-1">
            <Clock size={13} /> {totalLength(c().durationSeconds)}
          </span>
        </p>
        <div class="mt-auto pt-2">
          <div class="flex justify-between text-[12.5px] text-muted mb-1.5">
            <span>
              {c().lessonsCompleted} / {c().lessonsTotal} watched
            </span>
            <span class="tabular font-semibold text-ink-2">{c().percent}%</span>
          </div>
          <ProgressBar value={c().percent} />
          <span class="mt-3 btn btn-primary btn-sm w-full">{action()}</span>
        </div>
      </div>
    </Link>
  );
}
