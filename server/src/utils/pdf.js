// Minimal PDF writer for server-generated documents (certificates).
// Standard Helvetica fonts (WinAnsi), text and filled rectangles, no
// dependencies — the same approach as the frontend's src/lib/pdf.js.

// Helvetica advance widths (1/1000 em) for ASCII 32–126.
const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722,
  722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const MAP = { "—": 151, "–": 150, "’": 146, "‘": 145, "“": 147, "”": 148, "•": 149, "…": 133, "·": 183 };

export function encode(str) {
  let out = "";
  for (const ch of String(str ?? "")) {
    const c = ch.codePointAt(0);
    if (MAP[ch]) out += String.fromCharCode(MAP[ch]);
    else if (c >= 32 && c < 256) out += ch;
    else out += "?";
  }
  return out;
}

const esc = (s) => s.replace(/[\\()]/g, (m) => "\\" + m).replace(/[\x80-\xff]/g, (c) => "\\" + c.charCodeAt(0).toString(8).padStart(3, "0"));

export function textWidth(s, size, bold = false) {
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    w += (code >= 32 && code <= 126 ? WIDTHS[code - 32] : 556) * (bold ? 1.06 : 1);
  }
  return (w * size) / 1000;
}

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(" ");
};

// One page. draw(api) uses api.text / api.center / api.right / api.rect.
export function singlePagePdf({ width, height, title, draw }) {
  const ops = [];
  const api = {
    width,
    height,
    text(s, x, y, size, color = "#000000", bold = false) {
      ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(encode(s))}) Tj ET`);
    },
    center(s, y, size, color, bold = false) {
      api.text(s, (width - textWidth(encode(s), size, bold)) / 2, y, size, color, bold);
    },
    right(s, xRight, y, size, color, bold = false) {
      api.text(s, xRight - textWidth(encode(s), size, bold), y, size, color, bold);
    },
    rect(x, y, w, h, color) {
      ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    },
  };
  draw(api);
  const stream = ops.join("\n");
  const objs = [
    null,
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [5 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
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
  return Buffer.from(out, "latin1");
}
