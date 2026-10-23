// ─── Charts ─────────────────────────────────────────────────────────────────
// Single-series SVG charts for the admin overview. One hue (plum in light,
// lime in dark), thin marks with 4px rounded data-ends on the baseline, a
// recessive grid, per-mark hover tooltips and a screen-reader table. No
// categorical palettes: identity is always carried by text labels.

import { createSignal, For, Show } from "solid-js";
import { cx } from "../lib/format";

const MARK = "fill-plum-500 dark:fill-lime-400";
const MARK_DIM = "fill-plum-200 dark:fill-lime-400/35";

function SrTable(props) {
  return (
    // Tables refuse to shrink to sr-only's 1px width, so clip a wrapper instead.
    <div class="sr-only">
    <table>
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          <th>{props.xLabel}</th>
          <th>{props.yLabel}</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.rows}>
          {(r) => (
            <tr>
              <td>{r.label}</td>
              <td>{r.value ?? "—"}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
    </div>
  );
}

function Tooltip(props) {
  return (
    <div
      class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full px-3 py-2 rounded-xl bg-plum-950 text-white text-[13px] shadow-float border border-white/10 whitespace-nowrap"
      style={{ left: `${props.x}%`, top: `calc(${props.y}% - 8px)` }}
    >
      <p class="text-white/60">{props.label}</p>
      <p class="font-semibold text-[14px] tabular">{props.value}</p>
    </div>
  );
}

// Vertical columns. data: [{ label, value }], value 0..max.
export function ColumnChart(props) {
  const [hover, setHover] = createSignal(null);
  const H = props.height ?? 200;
  // Wider viewBox for wide cards keeps the text at a readable size.
  const W = props.width ?? 600;
  const pad = { t: 12, b: 26, l: 30, r: 6 };
  const max = () => props.max ?? Math.max(1, ...props.data.map((d) => d.value || 0));
  const ticks = () => {
    if (props.ticks) return props.ticks;
    const m = max();
    const step = m <= 5 ? 1 : Math.ceil(m / 4 / (m > 20 ? 10 : 1)) * (m > 20 ? 10 : 1);
    const out = [];
    for (let v = 0; v <= m; v += step) out.push(v);
    return out;
  };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = () => innerW / props.data.length;
  const barW = () => Math.min(props.barWidth ?? 34, slot() * 0.56);
  const y = (v) => pad.t + innerH - (v / max()) * innerH;
  const fmt = (v) => (props.format ? props.format(v) : v);

  return (
    <div class="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} class="w-full h-auto overflow-visible" role="img" aria-label={props.ariaLabel}>
        <For each={ticks()}>
          {(t) => (
            <g>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} class="stroke-line" stroke-width="1" stroke-dasharray={t === 0 ? "" : "3 4"} />
              <text x={pad.l - 8} y={y(t) + 3.5} text-anchor="end" class="fill-muted text-[11px] tabular">
                {fmt(t)}
              </text>
            </g>
          )}
        </For>
        <Show when={props.reference != null}>
          <line x1={pad.l} x2={W - pad.r} y1={y(props.reference)} y2={y(props.reference)} class="stroke-ink-2/45" stroke-width="1.5" stroke-dasharray="6 4" />
          <text x={W - pad.r} y={y(props.reference) - 6} text-anchor="end" class="fill-muted text-[11.5px]">
            {props.referenceLabel}
          </text>
        </Show>
        <For each={props.data}>
          {(d, i) => {
            const cx_ = () => pad.l + slot() * i() + slot() / 2;
            const h = () => Math.max(d.value ? 3 : 0, (d.value / max()) * innerH);
            const top = () => pad.t + innerH - h();
            // Rounded top corners (4px), square on the baseline.
            const path = () => {
              const x = cx_() - barW() / 2;
              const w = barW();
              const r = Math.min(4, h());
              return `M${x},${pad.t + innerH} V${top() + r} Q${x},${top()} ${x + r},${top()} H${x + w - r} Q${x + w},${top()} ${x + w},${top() + r} V${pad.t + innerH} Z`;
            };
            return (
              <g>
                <path
                  d={path()}
                  class={cx("transition-[fill,opacity] duration-200", hover() == null || hover() === i() ? MARK : MARK_DIM)}
                />
                {/* Hit target: the whole column slot. */}
                <rect
                  x={cx_() - slot() / 2}
                  y={pad.t}
                  width={slot()}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i())}
                />
                <text x={cx_()} y={H - 8} text-anchor="middle" class={cx("text-[11.5px]", hover() === i() ? "fill-ink font-semibold" : "fill-muted")}>
                  {d.short ?? d.label}
                </text>
              </g>
            );
          }}
        </For>
      </svg>
      <Show when={hover() != null}>
        {(() => {
          const d = props.data[hover()];
          const x = ((pad.l + slot() * hover() + slot() / 2) / W) * 100;
          return <Tooltip x={x} y={(y(d.value) / H) * 100} label={d.label} value={d.tooltip ?? fmt(d.value)} />;
        })()}
      </Show>
      <SrTable caption={props.ariaLabel} xLabel={props.xLabel ?? "Category"} yLabel={props.yLabel ?? "Value"} rows={props.data} />
    </div>
  );
}

// Line with markers and a crosshair. data: [{ label, value | null }].
export function LineChart(props) {
  const [hover, setHover] = createSignal(null);
  const H = props.height ?? 170;
  const W = 440;
  const pad = { t: 14, b: 26, l: 30, r: 10 };
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = () => props.data.length;
  const x = (i) => pad.l + (n() === 1 ? innerW / 2 : (innerW * i) / (n() - 1));
  const y = (v) => pad.t + innerH - ((v - min) / (max - min)) * innerH;
  const pts = () => props.data.map((d, i) => (d.value == null ? null : [x(i), y(d.value)]));
  // Break the line at gaps (weeks with no attempts).
  const segments = () => {
    const out = [];
    let cur = [];
    for (const p of pts()) {
      if (p) cur.push(p);
      else if (cur.length) {
        out.push(cur);
        cur = [];
      }
    }
    if (cur.length) out.push(cur);
    return out;
  };
  const ticks = [0, 25, 50, 75, 100].filter((t) => t >= min && t <= max);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < n(); i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  };
  const fmt = (v) => (v == null ? "No attempts" : props.format ? props.format(v) : v);

  return (
    <div class="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} class="w-full h-auto overflow-visible" role="img" aria-label={props.ariaLabel} onMouseMove={onMove}>
        <defs>
          <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" class="[stop-color:#87548F] dark:[stop-color:#C7E848]" stop-opacity="0.22" />
            <stop offset="100%" class="[stop-color:#87548F] dark:[stop-color:#C7E848]" stop-opacity="0" />
          </linearGradient>
        </defs>
        <For each={ticks}>
          {(t) => (
            <g>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} class="stroke-line" stroke-width="1" stroke-dasharray={t === min ? "" : "3 4"} />
              <text x={pad.l - 8} y={y(t) + 3.5} text-anchor="end" class="fill-muted text-[11px] tabular">
                {t}
              </text>
            </g>
          )}
        </For>
        <Show when={props.reference != null}>
          <line x1={pad.l} x2={W - pad.r} y1={y(props.reference)} y2={y(props.reference)} class="stroke-ink-2/40" stroke-width="1" stroke-dasharray="6 4" />
          <text x={W - pad.r} y={y(props.reference) - 5} text-anchor="end" class="fill-muted text-[11px]">
            {props.referenceLabel}
          </text>
        </Show>
        <For each={segments()}>
          {(seg) => (
            <>
              <path
                d={`M${seg[0][0]},${pad.t + innerH} ${seg.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${seg[seg.length - 1][0]},${pad.t + innerH} Z`}
                fill="url(#line-fill)"
              />
              <path
                d={seg.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ")}
                fill="none"
                class="stroke-plum-500 dark:stroke-lime-400"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
            </>
          )}
        </For>
        <Show when={hover() != null}>
          <line x1={x(hover())} x2={x(hover())} y1={pad.t} y2={pad.t + innerH} class="stroke-line-strong" stroke-width="1" />
        </Show>
        <For each={pts()}>
          {(p, i) => (
            <Show when={p}>
              <circle
                cx={p[0]}
                cy={p[1]}
                r={hover() === i() ? 5.5 : 4}
                class="fill-plum-500 dark:fill-lime-400 stroke-surface transition-all"
                stroke-width="2"
              />
            </Show>
          )}
        </For>
        <For each={props.data}>
          {(d, i) => (
            <text x={x(i())} y={H - 8} text-anchor="middle" class={cx("text-[11.5px]", hover() === i() ? "fill-ink font-semibold" : "fill-muted")}>
              {d.label}
            </text>
          )}
        </For>
      </svg>
      <Show when={hover() != null}>
        <Tooltip
          x={(x(hover()) / W) * 100}
          y={((props.data[hover()].value == null ? pad.t + innerH / 2 : y(props.data[hover()].value)) / H) * 100}
          label={props.data[hover()].label}
          value={fmt(props.data[hover()].value)}
        />
      </Show>
      <SrTable caption={props.ariaLabel} xLabel="Week" yLabel={props.yLabel ?? "Value"} rows={props.data} />
    </div>
  );
}

// Labelled horizontal bars (one hue). rows: [{ label, value, max?, hint? }]
export function BarList(props) {
  const max = () => props.max ?? Math.max(1, ...props.rows.map((r) => r.value));
  return (
    <ul class="grid gap-3.5">
      <For each={props.rows}>
        {(r) => (
          <li class="grid gap-1.5" title={r.tooltip}>
            <div class="flex items-center justify-between gap-3 text-[14px]">
              <span class="flex items-center gap-2 min-w-0 font-medium text-ink-2">
                {r.icon}
                <span class="truncate">{r.label}</span>
              </span>
              <span class="shrink-0 font-semibold tabular text-ink">
                {props.format ? props.format(r.value) : r.value}
                <Show when={r.hint}>
                  <span class="ml-1.5 font-normal text-muted">{r.hint}</span>
                </Show>
              </span>
            </div>
            <div class="h-2 rounded-full bg-sunken overflow-hidden">
              <div
                class="h-full rounded-full bg-gradient-to-r from-plum-400 to-plum-600 dark:from-lime-500 dark:to-lime-300 transition-[width] duration-1000 ease-out"
                style={{ width: `${(r.value / max()) * 100}%` }}
              />
            </div>
          </li>
        )}
      </For>
    </ul>
  );
}
