// ─── Tiny PDF writer ────────────────────────────────────────────────────────
// Mock-mode only. The backend will serve real PDF files by URL; until then
// this turns training content into a genuine, nicely laid-out A4 PDF so the
// document viewer and the Download button behave exactly as they will in
// production. Standard Helvetica (WinAnsi), text + filled shapes, no deps.
//
// makePdf({ kicker, title, subtitle, meta, blocks }) → { blob, pages }
//   block: { type: "h" | "p" | "li" | "num" | "tip" | "rule", text }

const W = 595.28; // A4 in points
const H = 841.89;
const M = 56; // side margin
const CONTENT_W = W - M * 2;

// Helvetica advance widths (1/1000 em) for ASCII 32–126.
const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];

// Unicode → WinAnsi code (or an ASCII stand-in).
const MAP = {
  "—": 151, "–": 150, "’": 146, "‘": 145, "“": 147, "”": 148,
  "•": 149, "…": 133, "÷": 247, "×": 215, "·": 183, "€": 128,
};
const SUBST = { "→": "->", "≤": "<=", "≥": ">=", "−": "-", "₹": "Rs.", "≈": "~" };

function encode(str) {
  let out = "";
  for (const ch of str) {
    if (SUBST[ch]) {
      out += SUBST[ch];
      continue;
    }
    const c = ch.codePointAt(0);
    if (MAP[ch]) out += String.fromCharCode(MAP[ch]);
    else if (c < 256) out += ch;
    else out += "?";
  }
  return out;
}

const charWidth = (code, bold) => {
  const w = code >= 32 && code <= 126 ? WIDTHS[code - 32] : 556;
  return bold ? w * 1.06 : w;
};
const textWidth = (s, size, bold) => {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += charWidth(s.charCodeAt(i), bold);
  return (w * size) / 1000;
};

function wrap(text, size, maxW, bold) {
  const words = encode(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textWidth(next, size, bold) <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const esc = (s) =>
  s.replace(/[\\()]/g, (m) => "\\" + m).replace(/[\x80-\xff]/g, (m) => "\\" + m.charCodeAt(0).toString(8).padStart(3, "0"));

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => (x / 255).toFixed(3)).join(" ");
};

const C = {
  ink: "#1F1424",
  body: "#4A3D50",
  muted: "#7D7083",
  midnight: "#542C5F",
  crimson: "#C7E848",
  gold: "#6B3B75",
  goldSoft: "#F5F1E8",
  line: "#E4DDCF",
};

export function makePdf({ kicker = "Aajneeti Academy", title, subtitle, meta, blocks }) {
  const pages = [];
  let ops = [];
  let y = 0;

  const text = (s, x, yy, size, color, bold = false) =>
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(color)} rg ${x.toFixed(2)} ${yy.toFixed(2)} Td (${esc(s)}) Tj ET`);
  const rect = (x, yy, w, h, color) => ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);

  const newPage = (first) => {
    if (ops.length) pages.push(ops);
    ops = [];
    if (first) {
      // Cover band.
      rect(0, H - 188, W, 188, C.midnight);
      rect(0, H - 191, W * 0.42, 3, C.crimson);
      text(encode(kicker.toUpperCase()), M, H - 62, 9, C.crimson, true);
      const tl = wrap(title, 24, CONTENT_W, true);
      let ty = H - 96;
      for (const l of tl.slice(0, 2)) {
        text(l, M, ty, 24, "#FFFFFF", true);
        ty -= 30;
      }
      if (subtitle) {
        for (const l of wrap(subtitle, 10.5, CONTENT_W, false).slice(0, 2)) {
          text(l, M, ty + 4, 10.5, "#E0CAE5");
          ty -= 15;
        }
      }
      y = H - 228;
      if (meta) {
        text(encode(meta), M, y, 9, C.muted);
        y -= 26;
      }
    } else {
      text(encode(`${kicker}  ·  ${title}`), M, H - 40, 8.5, C.muted);
      rect(M, H - 50, CONTENT_W, 0.6, C.line);
      y = H - 80;
    }
  };

  const need = (h) => {
    if (y - h < 70) newPage(false);
  };

  newPage(true);

  for (const b of blocks) {
    if (b.type === "h") {
      const lines = wrap(b.text, 14, CONTENT_W, true);
      need(lines.length * 19 + 30);
      y -= 10;
      rect(M, y + 2, 18, 2, C.crimson);
      y -= 14;
      for (const l of lines) {
        text(l, M, y, 14, C.ink, true);
        y -= 19;
      }
      y -= 4;
    } else if (b.type === "p") {
      const lines = wrap(b.text, 10.5, CONTENT_W, false);
      for (const l of lines) {
        need(16);
        text(l, M, y, 10.5, C.body);
        y -= 16;
      }
      y -= 8;
    } else if (b.type === "li" || b.type === "num") {
      const indent = 16;
      const lines = wrap(b.text, 10.5, CONTENT_W - indent, false);
      need(16);
      if (b.type === "li") rect(M + 2, y + 3, 4, 4, C.gold);
      else text(`${b.n}.`, M, y, 10.5, C.gold, true);
      for (const l of lines) {
        need(16);
        text(l, M + indent, y, 10.5, C.body);
        y -= 16;
      }
      y -= 3;
    } else if (b.type === "tip") {
      const lines = wrap(b.text, 10, CONTENT_W - 36, false);
      const h = lines.length * 15 + 30;
      need(h + 10);
      y -= 6;
      rect(M, y - h + 14, CONTENT_W, h, C.goldSoft);
      rect(M, y - h + 14, 3, h, C.gold);
      text(encode(b.label || "TIP"), M + 18, y - 4, 8.5, C.gold, true);
      let ty = y - 20;
      for (const l of lines) {
        text(l, M + 18, ty, 10, C.body);
        ty -= 15;
      }
      y -= h + 8;
    } else if (b.type === "rule") {
      need(20);
      rect(M, y, CONTENT_W, 0.6, C.line);
      y -= 18;
    }
  }
  pages.push(ops);

  // Footers, now that the page count is known.
  const total = pages.length;
  pages.forEach((p, i) => {
    p.push(`${rgb(C.line)} rg ${M} 46 ${CONTENT_W.toFixed(2)} 0.6 re f`);
    p.push(`BT /F1 8 Tf ${rgb(C.muted)} rg ${M} 32 Td (${esc(encode("Aajneeti Academy · Internal training material"))}) Tj ET`);
    const label = `Page ${i + 1} of ${total}`;
    p.push(`BT /F1 8 Tf ${rgb(C.muted)} rg ${(W - M - textWidth(label, 8)).toFixed(2)} 32 Td (${label}) Tj ET`);
  });

  // Assemble objects. Everything is ASCII (high bytes are octal-escaped), so
  // string length == byte length for the xref offsets.
  const objs = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  const kids = [];
  pages.forEach((p, i) => {
    const pageId = 5 + i * 2;
    const contentId = pageId + 1;
    const stream = p.join("\n");
    kids.push(`${pageId} 0 R`);
    objs[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objs[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info << /Title (${esc(encode(title))}) /Producer (Aajneeti Academy) >> >>\nstartxref\n${xref}\n%%EOF`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return { blob: new Blob([bytes], { type: "application/pdf" }), pages: total };
}
