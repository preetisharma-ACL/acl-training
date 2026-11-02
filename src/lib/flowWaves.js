// The moving silk behind the sign-in screens. A WebGL shader redraws the
// wave image every frame: the silk crests undulate in travelling waves, the
// reflection below the horizon follows them with a water ripple, and the
// silk shades as it bends. The image is fitted like CSS
// `background-size: cover` (centred), so it lines up with the static
// fallback underneath.
//
// mountFlowWaves(container, { src, animate, tone }) → cleanup function.
// tone "brand" recolours the silk to the login's navy and royal blue, with
// only a trace of the logo crimson (#AC2334) on the warmest edges;
// leave it out for the image's own colours.
// Returns a no-op when WebGL isn't available: the static image stays.

import { Renderer, Program, Mesh, Triangle, Texture } from "ogl";

const vertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uImg;
  uniform float uTone;
  varying vec2 vUv;

  // Horizon of the image (the line the reflection starts at), 0 = top.
  const float H = 0.762;
  const float TAU = 6.28318;
  // Overall pace of the waves and ripples (1.0 = the original slow drift).
  const float SPEED = 1.8;

  // Screen uv (y up) → image uv (y down), as background-size: cover.
  vec2 cover(vec2 p) {
    float s = max(uRes.x / uImg.x, uRes.y / uImg.y);
    vec2 size = uImg * s / uRes;
    vec2 uv = (p - 0.5) / size + 0.5;
    return vec2(uv.x, 1.0 - uv.y);
  }

  // Two long, slow travelling waves across the silk; the phase shifts with
  // height so the layers move against each other. Kept low-frequency so the
  // silk bends smoothly instead of smearing.
  float wave(float x, float v, float t) {
    return 0.022 * sin(TAU * 0.80 * x - 0.55 * t + v * 4.0)
         + 0.011 * sin(TAU * 1.45 * x + 0.75 * t + 1.3 - v * 2.5);
  }
  // Its slope along x (for the light on the silk).
  float slope(float x, float v, float t) {
    return 0.022 * TAU * 0.80 * cos(TAU * 0.80 * x - 0.55 * t + v * 4.0)
         + 0.011 * TAU * 1.45 * cos(TAU * 1.45 * x + 0.75 * t + 1.3 - v * 2.5);
  }
  // How much each height moves: still at the horizon, most at the crests,
  // fading out into the sky.
  float envelope(float v) {
    float a = H - v;
    return smoothstep(0.0, 0.2, a) * (1.0 - smoothstep(0.42, 0.62, a));
  }

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 uv = cover(vUv);
    float t = uTime * SPEED;
    vec2 s = uv;
    float light;

    if (uv.y < H) {
      float e = envelope(uv.y);
      s.y += wave(uv.x, uv.y, t) * e;
      s.x += 0.004 * sin(uv.y * 6.0 + t * 0.3) * e;
      light = slope(uv.x, uv.y, t) * e;
    } else {
      // Reflection: mirror the wave above, with a gentle water ripple.
      float m = uv.y - H;
      float vm = H - m;
      float e = envelope(vm);
      s.y -= wave(uv.x, vm, t) * e * 0.9;
      float r = smoothstep(0.0, 0.05, m);
      s.x += r * 0.0016 * sin(m * 120.0 - t * 1.2 + sin(uv.x * 5.0 + t * 0.4));
      light = slope(uv.x, vm, t) * e * 0.5;
    }

    // Sample with a light sharpen: the source image is only ~1200px wide.
    vec2 texel = 1.0 / uImg;
    vec3 col = texture2D(tMap, s).rgb;
    vec3 blur = (texture2D(tMap, s + vec2(texel.x, 0.0)).rgb + texture2D(tMap, s - vec2(texel.x, 0.0)).rgb
               + texture2D(tMap, s + vec2(0.0, texel.y)).rgb + texture2D(tMap, s - vec2(0.0, texel.y)).rgb) * 0.25;
    col += (col - blur) * 0.6;

    // Silk catching the light as the waves roll (shade only, no white wash).
    col *= 1.0 + 0.4 * light;

    // A touch more colour and contrast so the scene reads crisp, not hazy.
    col = mix(vec3(luma(col)), col, 1.12);
    col = (col - 0.5) * 1.05 + 0.5;

    // Brand tone: the sky becomes deep navy, the silk royal blue, the
    // brightest highlights ice blue, and only the warmest edges keep a trace
    // of the logo crimson (#AC2334).
    if (uTone > 0.5) {
      // Work from a softened, unsharpened sample: the tone curve would
      // otherwise bring out the JPEG blocks in the smooth sky.
      vec3 soft = (texture2D(tMap, s).rgb * 2.0 + blur * 4.0) / 6.0;
      soft = (mix(vec3(luma(soft)), soft, 1.12) - 0.5) * 1.05 + 0.5;
      soft *= 1.0 + 0.4 * light;
      float l = luma(soft);
      float warm = clamp((soft.r - soft.b) * 2.2, 0.0, 1.0);
      vec3 navyDeep = vec3(0.012, 0.022, 0.065);
      vec3 navy = vec3(0.03, 0.06, 0.16);
      vec3 royal = vec3(0.07, 0.13, 0.33);
      vec3 ice = vec3(0.6, 0.68, 0.88);
      vec3 crimson = vec3(0.675, 0.137, 0.204);
      vec3 toned = mix(navyDeep, navy, smoothstep(0.3, 0.85, l));
      toned = mix(toned, royal, smoothstep(0.2, 0.7, warm) * smoothstep(0.35, 0.85, l));
      toned = mix(toned, crimson, smoothstep(0.6, 1.0, warm) * smoothstep(0.45, 0.8, l) * 0.42);
      toned = mix(toned, ice, smoothstep(0.86, 1.0, l) * 0.32);
      // A touch of dither against banding in the deep navy.
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col = toned + (n - 0.5) / 128.0;
    }

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export function mountFlowWaves(container, { src, animate = true, tone } = {}) {
  let renderer;
  try {
    renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: false, antialias: false });
  } catch {
    return () => {};
  }
  const gl = renderer.gl;
  if (!gl) return () => {};

  const canvas = gl.canvas;
  canvas.className = "flow-canvas";
  container.appendChild(canvas);

  // flipY off: texture v = 0 is the top row, matching cover()'s image uv.
  const texture = new Texture(gl, { generateMipmaps: false, flipY: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      tMap: { value: texture },
      uTime: { value: 0 },
      uRes: { value: [1, 1] },
      uImg: { value: [1199, 672] },
      uTone: { value: tone === "brand" ? 1 : 0 },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  const resize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    program.uniforms.uRes.value = [w, h];
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let frame = 0;
  let start = 0;
  let stopped = false;
  const draw = (now) => {
    if (stopped) return;
    if (!start) start = now;
    program.uniforms.uTime.value = (now - start) / 1000 + 4; // start mid-swell
    renderer.render({ scene: mesh });
    if (animate) frame = requestAnimationFrame(draw);
  };

  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    if (stopped) return;
    texture.image = img;
    program.uniforms.uImg.value = [img.naturalWidth, img.naturalHeight];
    frame = requestAnimationFrame((now) => {
      draw(now);
      canvas.classList.add("is-ready");
    });
  };
  img.src = src;

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    ro.disconnect();
    canvas.remove();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
