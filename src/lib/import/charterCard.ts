/**
 * Parse the single "Project Charter" card, whose notes now hold every project
 * detail as labeled blocks:
 *
 *   Nom du Projet
 *   Environment RECLM
 *   Taches Timorc
 *   Mauritius9 - 100.003
 *   Objectif / Pourquoi nous le faisons / Critère de succès / Livrable Clès
 *   Resources          (one "Role: Name" per line)
 *   Budget             (Cost: Rs 1,200,000 / Hours: 50)
 *
 * Matching is accent- and case-insensitive and accepts English equivalents.
 * Blocks the app doesn't recognise stay untouched (attached to the current
 * section), so a charter written slightly differently still parses.
 */

import { HOURS_PER_DAY } from "@/lib/config";
import type { CharterSection, Resource } from "@/types/project";

export interface ParsedCharterCard {
  projectName: string;
  timorcCodes: string[];
  resources: Resource[];
  budgetHours: number | null;
  budgetCost: number | null;
  currency: string;
  /** Narrative sections (Objectif, Pourquoi…, Critère de succès, Livrable). */
  sections: CharterSection[];
}

type Kind = "name" | "timorc" | "objective" | "why" | "success" | "deliverable" | "resources" | "budget";

const stripDiacritics = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => stripDiacritics(s.trim().toLowerCase()).replace(/\s+/g, " ").replace(/[:：]\s*$/, "");

const LABELS: Array<{ kind: Kind; title: string; match: string[] }> = [
  { kind: "name", title: "Nom du Projet", match: ["nom du projet", "nom projet", "project name", "titre du projet"] },
  { kind: "timorc", title: "Taches Timorc", match: ["taches timorc", "tache timorc", "code timorc", "timorc"] },
  { kind: "objective", title: "Objectif", match: ["objectif", "objectifs", "ce que nous faisons", "what we do", "objective", "goal"] },
  { kind: "why", title: "Pourquoi nous le faisons", match: ["pourquoi nous le faisons", "pourquoi", "why we do it", "why"] },
  { kind: "success", title: "Critère de succès", match: ["critere de succes", "criteres de succes", "comment savoir si c est une reussite", "success criteria", "success"] },
  { kind: "deliverable", title: "Livrable clé", match: ["livrable cles", "livrable cle", "livrables cles", "livrables", "livrable", "key deliverable", "key deliverables", "deliverables"] },
  { kind: "resources", title: "Resources", match: ["resources", "ressources", "equipe", "team"] },
  { kind: "budget", title: "Budget", match: ["budget", "budgets"] },
];

/** The narrative sections shown on the Project Details tab, in display order. */
const NARRATIVE_ORDER: Array<{ kind: Kind; title: string }> = [
  { kind: "objective", title: "Objectif" },
  { kind: "why", title: "Pourquoi nous le faisons" },
  { kind: "success", title: "Critère de succès" },
  { kind: "deliverable", title: "Livrable clé" },
];

function labelKind(line: string): Kind | null {
  const l = norm(line);
  const hit = LABELS.find((s) => s.match.includes(l));
  return hit ? hit.kind : null;
}

function parseMoney(text: string): { amount: number | null; currency: string } {
  // Currency = a symbol or short code near the amount (Rs, MUR, €, $, £).
  const raw = text.match(/₨|€|\$|£|\brs\b|\bmur\b|\busd\b|\beur\b|\bgbp\b/i)?.[0] ?? "";
  const currency = /rs|mur/i.test(raw) ? "Rs" : raw;
  const digits = text.replace(/[^\d.,]/g, "").replace(/,/g, "");
  const amount = digits ? Number(digits) : NaN;
  return { amount: Number.isFinite(amount) ? amount : null, currency };
}

/** Parse an hours value; "6 days"/"1 jour" convert at HOURS_PER_DAY. */
function parseHours(text: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|heures?|d|day|days|j|jour|jours)?/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? "").toLowerCase();
  const isDay = /^(d|day|days|j|jour|jours)$/.test(unit);
  return isDay ? n * HOURS_PER_DAY : n;
}

function parseResourceLine(line: string): Resource | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(":");
  if (idx > 0) return { role: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx + 1).trim() };
  return { role: "", name: trimmed };
}

export function parseCharterCard(notes: string): ParsedCharterCard {
  const blocks = new Map<Kind, string[]>();
  let current: Kind | null = null;
  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const kind = labelKind(line);
    if (kind) {
      current = kind;
      if (!blocks.has(kind)) blocks.set(kind, []);
      continue;
    }
    if (current) blocks.get(current)!.push(line);
  }

  const block = (k: Kind) => blocks.get(k) ?? [];
  const projectName = block("name").join(" ").trim();
  const timorcCodes = block("timorc").map((l) => l.trim()).filter(Boolean);
  const resources = block("resources").map(parseResourceLine).filter((r): r is Resource => r != null);

  // Budget lines: classify each as cost or hours.
  let budgetHours: number | null = null;
  let budgetCost: number | null = null;
  let currency = "";
  for (const line of block("budget")) {
    const [keyPart, ...rest] = line.split(":");
    const value = rest.length > 0 ? rest.join(":") : line;
    const key = norm(keyPart);
    const isCost = /cost|cout|montant|budget|price|prix/.test(key) || /₨|rs|€|\$|£|mur/i.test(value);
    const isHours = /hour|heure|time|temps|day|jour|effort/.test(key);
    if (isCost && !isHours) {
      const { amount, currency: cur } = parseMoney(value);
      if (amount != null) { budgetCost = amount; if (cur) currency = cur; }
    } else if (isHours || /^\d/.test(value.trim())) {
      const h = parseHours(value);
      if (h != null) budgetHours = h;
    }
  }

  const sections: CharterSection[] = NARRATIVE_ORDER
    .map((s) => ({ title: s.title, body: block(s.kind).join("\n").trim() }))
    .filter((s) => s.body.length > 0);

  return { projectName, timorcCodes, resources, budgetHours, budgetCost, currency, sections };
}

/** True when the notes look like the new labeled charter card. */
export function looksLikeCharterCard(notes: string): boolean {
  return notes.split(/\r?\n/).some((l) => {
    const k = labelKind(l);
    return k === "budget" || k === "resources" || k === "name" || k === "timorc";
  });
}
