/**
 * Split the Project Charter notes into the three standard sections:
 *   • Ce que nous faisons
 *   • Pourquoi nous le faisons
 *   • Comment savoir si c'est une réussite
 *
 * Matching is accent- and case-insensitive and accepts common English
 * equivalents, so a charter written in either language is understood.
 */

export interface CharterSection {
  key: "what" | "why" | "success";
  title: string;
  body: string;
}

const stripDiacritics = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => stripDiacritics(s.trim().toLowerCase()).replace(/\s+/g, " ");

const SECTIONS: Array<{ key: CharterSection["key"]; title: string; match: string[] }> = [
  {
    key: "what",
    title: "Ce que nous faisons",
    match: ["ce que nous faisons", "what we do", "what we are doing", "what we're doing"],
  },
  {
    key: "why",
    title: "Pourquoi nous le faisons",
    match: ["pourquoi nous le faisons", "why we do it", "why we are doing it", "why"],
  },
  {
    key: "success",
    title: "Comment savoir si c'est une réussite",
    match: ["comment savoir si c", "how will we know", "how we will know", "how do we know", "success"],
  },
];

/** A line is a section header if it matches one of the known headings. */
function headerIndexFor(line: string): number {
  const l = norm(line);
  return SECTIONS.findIndex((s) => s.match.some((m) => l === m || l.startsWith(m)));
}

/**
 * Returns the three sections in canonical order, each with whatever body text
 * followed its header. Sections absent from the notes come back with an empty
 * body so the tab can still list all three headers.
 */
export function splitCharterSections(notes: string): CharterSection[] {
  const bodies: Record<number, string[]> = { 0: [], 1: [], 2: [] };
  let current = -1;
  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (current >= 0) bodies[current].push("");
      continue;
    }
    const idx = headerIndexFor(line);
    if (idx >= 0) {
      current = idx;
      continue;
    }
    if (current >= 0) bodies[current].push(line);
  }
  return SECTIONS.map((s, i) => ({ key: s.key, title: s.title, body: bodies[i].join("\n").trim() }));
}

/** True when the notes contain at least one recognizable section header. */
export function hasCharterSections(notes: string): boolean {
  return notes.split(/\r?\n/).some((l) => headerIndexFor(l) >= 0);
}
