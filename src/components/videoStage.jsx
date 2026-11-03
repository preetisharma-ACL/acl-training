// Our own chrome around a YouTube IFrame player: YouTube's controls are off
// (controls=0) and the iframe never gets the pointer, so its title bar,
// "Watch on YouTube", share link and fullscreen button never appear. The
// iframe is also 3× taller than the stage and centred, so anything YouTube
// pins to its top or bottom edge sits outside the clipped area while the
// video itself (letterboxed to the iframe's width) fills the stage.
//
// The page still owns the player (creates it on `hostRef`, loads videos);
// this component only reads it through `player()` and the `state()` signal.
//
// Keys (when the player has focus): Space/K play-pause · ←/→ 5 s · J/L 10 s
// · ↑/↓ volume · M mute · F fullscreen · Home/End.

import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { Play, Pause, RotateCcw, RotateCw, Volume2, Volume1, VolumeX, Maximize, Minimize, LoaderCircle } from "lucide-solid";
import { cx } from "../lib/format";
import { clock } from "../lib/youtube";

const IDLE_MS = 2500;
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// YT.PlayerState
const UNSTARTED = -1;
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;
const CUED = 5;

export default function VideoStage(props) {
  let stage;
  let bar;
  const p = () => props.player();

  const [time, setTime] = createSignal(0);
  const [length, setLength] = createSignal(0);
  const [loaded, setLoaded] = createSignal(0);
  const [volume, setVolume] = createSignal(100);
  const [muted, setMuted] = createSignal(false);
  const [rate, setRate] = createSignal(1);
  const [scrub, setScrub] = createSignal(null); // seconds while dragging
  const [hover, setHover] = createSignal(null); // 0–1 over the bar
  const [active, setActive] = createSignal(true);
  const [menu, setMenu] = createSignal(false);
  const [native, setNative] = createSignal(false);
  const [pseudo, setPseudoFull] = createSignal(false); // iPhone: no element fullscreen
  // Pseudo fullscreen covers the page, so stop it scrolling underneath.
  const setPseudo = (v) => {
    document.body.style.overflow = v ? "hidden" : "";
    setPseudoFull(v);
  };

  const state = () => props.state();
  const playing = () => state() === PLAYING;
  const fresh = () => state() === UNSTARTED || state() === CUED;
  const duration = () => length() || props.duration || 0;
  const shown = () => !playing() || active() || menu() || scrub() != null;
  const full = () => native() || pseudo();

  // ── Reading the player ──
  let volumeTouched = 0;
  onMount(() => {
    const tick = setInterval(() => {
      const pl = p();
      if (!pl?.getCurrentTime) return;
      if (scrub() == null) setTime(pl.getCurrentTime() || 0);
      setLength(pl.getDuration() || 0);
      setLoaded(pl.getVideoLoadedFraction?.() || 0);
      setRate(pl.getPlaybackRate?.() || 1);
      if (Date.now() - volumeTouched > 1000) {
        setVolume(pl.getVolume?.() ?? 100);
        setMuted(pl.isMuted?.() ?? false);
      }
    }, 250);
    onCleanup(() => clearInterval(tick));
  });

  // ── Actions ──
  const toggle = () => {
    const pl = p();
    if (!pl?.playVideo) return;
    if (state() === ENDED) seek(0);
    playing() || state() === BUFFERING ? pl.pauseVideo() : pl.playVideo();
  };
  const seek = (t) => {
    const pl = p();
    if (!pl?.seekTo) return;
    const to = clamp(t, 0, Math.max(0, duration() - 0.5));
    pl.seekTo(to, true);
    setTime(to);
  };
  const skip = (d) => seek((scrub() ?? time()) + d);
  const setVol = (v) => {
    const pl = p();
    if (!pl?.setVolume) return;
    volumeTouched = Date.now();
    const n = clamp(Math.round(v), 0, 100);
    pl.setVolume(n);
    setVolume(n);
    if (n > 0 && muted()) {
      pl.unMute();
      setMuted(false);
    }
  };
  const toggleMute = () => {
    const pl = p();
    if (!pl?.mute) return;
    volumeTouched = Date.now();
    if (muted() || volume() === 0) {
      pl.unMute();
      if (volume() === 0) setVol(50);
      setMuted(false);
    } else {
      pl.mute();
      setMuted(true);
    }
  };
  const pickRate = (r) => {
    p()?.setPlaybackRate?.(r);
    setRate(r);
    setMenu(false);
  };
  const rates = () => {
    const list = p()?.getAvailablePlaybackRates?.();
    return list?.length > 1 ? list : RATES;
  };

  // ── Fullscreen ──
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const toggleFull = () => {
    if (pseudo()) return setPseudo(false);
    if (fsElement()) return (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (!request) return setPseudo(true);
    Promise.resolve(request.call(stage)).catch(() => setPseudo(true));
  };
  onMount(() => {
    const sync = () => setNative(fsElement() === stage);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      if (pseudo()) document.body.style.overflow = "";
    });
  });

  // ── Auto-hiding the controls ──
  let idle;
  const poke = () => {
    setActive(true);
    clearTimeout(idle);
    idle = setTimeout(() => setActive(false), IDLE_MS);
  };
  onCleanup(() => clearTimeout(idle));

  // ── Clicks on the video ──
  let pointerType = "mouse";
  let clickTimer;
  onCleanup(() => clearTimeout(clickTimer));
  const onVideoClick = (e) => {
    if (menu()) return setMenu(false);
    // First tap on a phone just brings the controls back.
    if (pointerType === "touch" && !shown()) return poke();
    clearTimeout(clickTimer);
    if (e.detail > 1) return toggleFull();
    // Wait a beat so a double-click (fullscreen) doesn't also pause.
    clickTimer = setTimeout(toggle, pointerType === "mouse" ? 200 : 0);
    poke();
  };

  // ── Keyboard ──
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = e.target.tagName;
    if ((e.key === " " || e.key === "Enter") && (tag === "BUTTON" || tag === "INPUT")) return;
    if (tag === "INPUT" && e.key.startsWith("Arrow")) return;
    const keys = {
      " ": toggle,
      k: toggle,
      arrowleft: () => skip(-5),
      arrowright: () => skip(5),
      j: () => skip(-10),
      l: () => skip(10),
      arrowup: () => setVol(volume() + 5),
      arrowdown: () => setVol(volume() - 5),
      m: toggleMute,
      f: toggleFull,
      home: () => seek(0),
      end: () => seek(duration()),
      escape: () => (menu() ? setMenu(false) : pseudo() && setPseudo(false)),
    };
    const fn = keys[e.key.toLowerCase()];
    if (!fn) return;
    e.preventDefault();
    fn();
    poke();
  };

  // ── Progress bar ──
  const fraction = (e) => {
    const r = bar.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width, 0, 1);
  };
  const onBarDown = (e) => {
    if (!duration()) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    setScrub(fraction(e) * duration());
  };
  const onBarMove = (e) => {
    setHover(fraction(e));
    if (scrub() != null) setScrub(fraction(e) * duration());
  };
  const onBarUp = () => {
    if (scrub() == null) return;
    seek(scrub());
    setScrub(null);
  };
  const shownTime = () => scrub() ?? time();
  const pct = () => (duration() ? clamp((shownTime() / duration()) * 100, 0, 100) : 0);

  const VolumeIcon = (iconProps) => (
    <Show when={!muted() && volume() > 0} fallback={<VolumeX size={iconProps.size} />}>
      <Show when={volume() >= 50} fallback={<Volume1 size={iconProps.size} />}>
        <Volume2 size={iconProps.size} />
      </Show>
    </Show>
  );

  return (
    <div
      ref={stage}
      tabIndex={0}
      aria-label="Video player"
      class={cx(
        "relative overflow-hidden bg-black select-none outline-none focus-visible:ring-2 focus-visible:ring-lime-400",
        pseudo() ? "!fixed inset-0 z-[100] w-screen h-[100dvh] !rounded-none" : full() ? "!rounded-none" : props.class,
        !shown() && "cursor-none"
      )}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={poke}
      onPointerDown={(e) => (pointerType = e.pointerType || "mouse")}
      onPointerLeave={() => playing() && setActive(false)}
    >
      {/* The iframe: full width, 3× tall, centred; never takes the pointer. */}
      <div class="absolute inset-0 pointer-events-none">
        <div class="relative h-full mx-auto" style={{ "max-width": full() ? "calc(100dvh * 16 / 9)" : undefined }}>
          <div class="absolute inset-x-0 top-[-100%] h-[300%]">
            <div ref={props.hostRef} />
          </div>
        </div>
      </div>

      {/* Click / tap target over the video. */}
      <div class="absolute inset-0 z-10" onClick={onVideoClick} />

      {/* Before the first play: our poster instead of YouTube's. */}
      <Show when={fresh() || state() === ENDED}>
        <div class="absolute inset-0 z-10 pointer-events-none bg-black">
          <Show when={props.poster}>
            <img src={props.poster} alt="" class={cx("w-full h-full", full() ? "object-contain" : "object-cover")} />
          </Show>
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
        </div>
      </Show>

      {/* Centre: big play / replay, or the buffering spinner. */}
      <div class="absolute inset-0 z-10 grid place-items-center pointer-events-none">
        <Show when={state() === BUFFERING}>
          <LoaderCircle size={44} class="text-white/90 animate-spin drop-shadow" />
        </Show>
        <Show when={fresh() || state() === PAUSED || state() === ENDED}>
          <button
            class="pointer-events-auto grid place-items-center w-16 h-16 sm:w-[76px] sm:h-[76px] rounded-full bg-lime-400 text-plum-950 shadow-float transition hover:scale-105 active:scale-95"
            aria-label={state() === ENDED ? "Replay" : "Play"}
            onClick={() => {
              toggle();
              poke();
            }}
          >
            <Show when={state() !== ENDED} fallback={<RotateCcw size={28} />}>
              <Play size={28} class="ml-1" fill="currentColor" />
            </Show>
          </button>
        </Show>
      </div>

      {/* Control bar */}
      <div
        class={cx(
          "absolute inset-x-0 bottom-0 z-20 px-2 sm:px-4 pt-10 pb-1.5 sm:pb-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white transition-opacity duration-300",
          shown() ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div
          ref={bar}
          class="group/bar relative h-5 flex items-center cursor-pointer touch-none"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration())}
          aria-valuenow={Math.round(shownTime())}
          aria-valuetext={`${clock(shownTime())} of ${clock(duration())}`}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={() => setScrub(null)}
          onPointerLeave={() => setHover(null)}
        >
          <div class={cx("relative w-full rounded-full bg-white/25 transition-[height]", scrub() != null ? "h-1.5" : "h-1 group-hover/bar:h-1.5")}>
            <div class="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${loaded() * 100}%` }} />
            <div class="absolute inset-y-0 left-0 rounded-full bg-lime-400" style={{ width: `${pct()}%` }} />
            <div
              class={cx("absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400 shadow transition-transform", scrub() != null ? "scale-100" : "scale-0 group-hover/bar:scale-100")}
              style={{ left: `${pct()}%` }}
            />
          </div>
          <Show when={hover() != null && duration()}>
            <span
              class="absolute bottom-full mb-1.5 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/85 text-[12px] font-medium tabular pointer-events-none"
              style={{ left: `clamp(24px, ${hover() * 100}%, calc(100% - 24px))` }}
            >
              {clock(hover() * duration())}
            </span>
          </Show>
        </div>

        <div class="flex items-center gap-0.5 sm:gap-1">
          <CtrlButton label={playing() ? "Pause (K)" : "Play (K)"} onClick={toggle}>
            <Show when={playing() || state() === BUFFERING} fallback={<Play size={20} fill="currentColor" />}>
              <Pause size={20} fill="currentColor" />
            </Show>
          </CtrlButton>
          <CtrlButton label="Back 10 seconds (J)" onClick={() => skip(-10)}>
            <RotateCcw size={18} />
          </CtrlButton>
          <CtrlButton label="Forward 10 seconds (L)" onClick={() => skip(10)}>
            <RotateCw size={18} />
          </CtrlButton>

          <div class="group/vol flex items-center">
            <CtrlButton label={muted() ? "Unmute (M)" : "Mute (M)"} onClick={toggleMute}>
              <VolumeIcon size={19} />
            </CtrlButton>
            <input
              type="range"
              min="0"
              max="100"
              value={muted() ? 0 : volume()}
              aria-label="Volume"
              class="hidden sm:block w-0 group-hover/vol:w-20 focus:w-20 transition-[width] duration-200 accent-lime-400 cursor-pointer"
              onInput={(e) => setVol(Number(e.currentTarget.value))}
            />
          </div>

          <span class="ml-1.5 sm:ml-2 text-[12.5px] sm:text-[13px] tabular text-white/90 whitespace-nowrap">
            {clock(shownTime())} <span class="text-white/50">/ {clock(duration())}</span>
          </span>

          <span class="flex-1" />

          <div class="relative">
            <button
              class="h-9 px-2.5 rounded-lg text-[13px] font-semibold tabular hover:bg-white/15 transition"
              aria-label="Playback speed"
              aria-expanded={menu()}
              onClick={() => setMenu(!menu())}
            >
              {rate()}×
            </button>
            <Show when={menu()}>
              <div class="absolute bottom-full right-0 mb-2 py-1.5 min-w-[112px] rounded-xl bg-black/90 backdrop-blur ring-1 ring-white/10 shadow-float">
                <p class="px-3 pt-0.5 pb-1.5 text-[11px] uppercase tracking-[0.12em] text-white/50">Speed</p>
                <For each={rates()}>
                  {(r) => (
                    <button
                      class={cx("w-full px-3 py-1.5 text-left text-[13.5px] tabular hover:bg-white/10", r === rate() && "text-lime-300 font-semibold")}
                      onClick={() => pickRate(r)}
                    >
                      {r === 1 ? "Normal" : `${r}×`}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <CtrlButton label={full() ? "Exit full screen (F)" : "Full screen (F)"} onClick={toggleFull}>
            <Show when={full()} fallback={<Maximize size={18} />}>
              <Minimize size={18} />
            </Show>
          </CtrlButton>
        </div>
      </div>

      {/* Page overlays (errors, "up next"…) sit above everything. */}
      {props.children}
    </div>
  );
}

function CtrlButton(props) {
  return (
    <button class="grid place-items-center w-9 h-9 rounded-lg hover:bg-white/15 transition" aria-label={props.label} title={props.label} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
