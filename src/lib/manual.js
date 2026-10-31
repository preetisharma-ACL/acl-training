// Mini-markdown ⇄ manual content, shared by the admin editor (live preview)
// and the admin service. Pure functions.

//   "# Title" starts a chapter, "## Heading" a sub-heading, "- item" / "1. item"
//   list items, "> text" a callout; blank lines separate paragraphs.
export function parseManual(text) {
  const chapters = [];
  let ch = null;
  let list = null;
  const ensure = () => {
    if (!ch) {
      ch = { id: `ch-${chapters.length + 1}`, title: "Overview", blocks: [] };
      chapters.push(ch);
    }
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      list = null;
      continue;
    }
    if (line.startsWith("# ")) {
      ch = { id: `ch-${chapters.length + 1}`, title: line.slice(2).trim(), blocks: [] };
      chapters.push(ch);
      list = null;
      continue;
    }
    ensure();
    const ul = line.match(/^[-*]\s+(.*)/);
    const ol = line.match(/^\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        list = { type, items: [] };
        ch.blocks.push(list);
      }
      list.items.push((ul || ol)[1]);
      continue;
    }
    list = null;
    if (line.startsWith("## ")) ch.blocks.push({ type: "h", text: line.slice(3) });
    else if (line.startsWith("> ")) ch.blocks.push({ type: "callout", tone: "info", title: "Note", text: line.slice(2) });
    else {
      const last = ch.blocks[ch.blocks.length - 1];
      // Consecutive lines join into one paragraph.
      if (last?.type === "p" && !raw.startsWith(" ") && last._open) last.text += " " + line;
      else ch.blocks.push({ type: "p", text: line, _open: true });
    }
  }
  for (const c of chapters) for (const b of c.blocks) delete b._open;
  return { chapters };
}

export function manualToText(content) {
  return content.chapters
    .map((c) =>
      [
        `# ${c.title}`,
        ...c.blocks.map((b) => {
          if (b.type === "p") return b.text;
          if (b.type === "h") return `## ${b.text}`;
          if (b.type === "ul") return b.items.map((i) => `- ${i}`).join("\n");
          if (b.type === "ol") return b.items.map((i, n) => `${n + 1}. ${i}`).join("\n");
          if (b.type === "callout") return `> ${b.text}`;
          return "";
        }),
      ].join("\n\n"),
    )
    .join("\n\n");
}

