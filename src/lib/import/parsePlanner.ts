/**
 * Microsoft Planner board export parser (French or English exports).
 *
 * The "Project Charter" card now holds every detail in its notes as labeled
 * blocks (project name, Timorc code, objective/why/success, key deliverable,
 * resources, and a budget in cost and/or hours). Older exports with separate
 * "Taches Timorc" and "Resources" cards are still supported as a fallback.
 *
 * Tasks carry an effort estimate in their label (e.g. "3 days", "2 hrs").
 *
 * Everything runs in the browser; the file never leaves the machine.
 */

import * as XLSX from "xlsx";

import type { Priority, Project, ProjectCharter, Resource, Task, TimorcCode } from "@/types/project";
import type { ValidationIssue, ValidationReport } from "@/types/validation";
import { HOURS_PER_DAY } from "@/lib/config";
import { hashId } from "@/lib/utils";
import { looksLikeCharterCard, parseCharterCard } from "./charterCard";

const PROJECT_DETAILS_BUCKET = "project details";
const CARD_CHARTER = "project charter";
const CARD_TIMORC = "taches timorc";
const CARD_RESOURCES = "resources";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// ---------------------------------------------------------------------------
// Column resolution (French + English Planner headers)
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<string, string[]> = {
  id: ["id de tâche", "id de tache", "task id"],
  title: ["nom de tâche", "nom de tache", "task name"],
  bucket: ["catégorie", "categorie", "bucket", "compartiment", "nom du compartiment"],
  progress: ["statut", "status", "progress", "avancement"],
  priority: ["priorité", "priorite", "priority"],
  assignee: ["attribué à", "attribue a", "assigned to", "assigned"],
  created: ["date de création", "date de creation", "created date"],
  due: ["date d’échéance", "date d'échéance", "date d’echeance", "due date"],
  start: ["date de début", "date de debut", "start date"],
  end: ["date de fin", "completed date", "date d’achèvement"],
  overdue: ["en retard", "late", "overdue"],
  labels: ["étiquettes", "etiquettes", "labels", "tags"],
  notes: ["commentaires", "notes", "description", "comments"],
  checklist: ["éléments de la liste de contrôle", "elements de la liste de controle", "checklist items", "checklist"],
};

function resolveColumns(header: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  const normHeader = header.map((h) => norm(h));
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normHeader.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Cell coercion
// ---------------------------------------------------------------------------

function toText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86_400_000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const text = String(v).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/.exec(text);
  if (dmy) {
    const year = +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3];
    const d = new Date(Date.UTC(year, +dmy[2] - 1, +dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

const PRIORITY_MAP: Record<string, Priority> = {
  urgent: "Critical", critique: "Critical", critical: "Critical",
  élevé: "High", eleve: "High", élevée: "High", important: "High", high: "High",
  moyen: "Medium", moyenne: "Medium", medium: "Medium",
  faible: "Low", low: "Low",
};
const toPriority = (v: unknown): Priority => PRIORITY_MAP[norm(v)] ?? "";

/** Hours label like "50 hrs" (legacy budget fallback). */
function parseHoursLabel(label: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|heures?)?/i.exec(label);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Task effort estimate from a label ("3 days", "2 hrs"); days → HOURS_PER_DAY. */
function parseEstimateHours(labels: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|heures?|d|day|days|j|jour|jours)\b/i.exec(labels);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return /^(d|day|days|j|jour|jours)$/i.test(m[2]) ? n * HOURS_PER_DAY : n;
}

/**
 * Task progress % — the manager writes "Avancement : 20%" in a checklist item
 * (or a bare "20%" in labels/notes). Blank ("Avancement :") ⇒ null (not set).
 */
function parseProgressPct(...sources: string[]): number | null {
  const text = sources.join("\n");
  const m = /avancement\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%/i.exec(text) ?? /(?:^|[\s;,])(\d{1,3})\s*%/.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
}

// ---------------------------------------------------------------------------
// Legacy special-card parsing (fallback)
// ---------------------------------------------------------------------------

function parseResourcesLegacy(notes: string): Resource[] {
  const lines = notes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const resources: Resource[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const role = lines[i];
    const name = lines[i + 1];
    if (name) resources.push({ role, name });
    else if (role) resources.push({ role: "", name: role });
  }
  return resources;
}

function toTimorcCodes(codes: string[]): TimorcCode[] {
  const seen = new Set<string>();
  const out: TimorcCode[] = [];
  for (const code of codes) {
    const key = norm(code);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ code, projectPrefix: code.split(/\s*-\s*/)[0]?.trim() ?? code });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Board detection & parsing
// ---------------------------------------------------------------------------

export function looksLikePlannerBoard(wb: XLSX.WorkBook): boolean {
  const names = wb.SheetNames.map((n) => norm(n));
  return ["plan", "catégories", "categories", "buckets", "données consolidées", "donnees consolidees", "consolidated data", "tasks", "tâches", "taches"].some((n) => names.includes(n));
}

function sheetGrid(wb: XLSX.WorkBook, wanted: string[]): unknown[][] | null {
  const name = wb.SheetNames.find((n) => wanted.includes(norm(n)));
  if (!name) return null;
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null, blankrows: false });
}

export interface ParsedBoard {
  project: Project;
  report: ValidationReport;
}

export function parsePlannerBoard(fileName: string, buffer: ArrayBuffer): ParsedBoard {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const issues: ValidationIssue[] = [];

  const planGrid = sheetGrid(wb, ["plan"]);
  const planRow = planGrid?.[1] ?? [];
  const planId = toText(planRow[0]);
  const planName = toText(planRow[1]) || fileName.replace(/\.[^.]+$/, "");

  const taskGrid =
    sheetGrid(wb, ["données consolidées", "donnees consolidees", "consolidated data"]) ??
    sheetGrid(wb, ["tâches", "taches", "tasks"]);
  if (!taskGrid || taskGrid.length < 2) {
    issues.push({ severity: "error", scope: "Board", message: "No task sheet found — expected a Microsoft Planner export with a 'Consolidated Data'/'Données consolidées' or 'Tasks'/'Tâches' sheet." });
    return { project: emptyProject(fileName, planId, planName), report: report(fileName, "board", issues) };
  }

  const cols = resolveColumns(taskGrid[0] ?? []);
  const cell = (row: unknown[], key: string) => (cols[key] != null ? row[cols[key]] : null);

  const bucketGrid = sheetGrid(wb, ["catégories", "categories", "buckets"]);
  const orderedBuckets: string[] = [];
  if (bucketGrid) {
    for (const row of bucketGrid.slice(1)) {
      const name = toText(row[1]);
      if (name && norm(name) !== PROJECT_DETAILS_BUCKET) orderedBuckets.push(name);
    }
  }

  let charter: ProjectCharter = {
    projectName: planName, projectCode: "", planId,
    startDate: null, endDate: null, budgetHours: null, budgetCost: null, currency: "",
    manager: "", sections: [], notes: "",
  };
  let resources: Resource[] = [];
  let timorcCodes: TimorcCode[] = [];
  let legacyTimorc: string[] = [];
  let legacyResources: Resource[] = [];
  const tasks: Task[] = [];
  const seenBuckets = new Set(orderedBuckets.map((b) => norm(b)));

  for (const row of taskGrid.slice(1)) {
    const title = toText(cell(row, "title"));
    if (!title) continue;
    const bucket = toText(cell(row, "bucket"));
    const notes = toText(cell(row, "notes"));
    const labels = toText(cell(row, "labels"));

    if (norm(bucket) === PROJECT_DETAILS_BUCKET) {
      const t = norm(title);
      if (t === CARD_CHARTER) {
        const start = toDate(cell(row, "start"));
        const end = toDate(cell(row, "due")) ?? toDate(cell(row, "end"));
        if (looksLikeCharterCard(notes)) {
          const parsed = parseCharterCard(notes);
          charter = {
            ...charter,
            projectName: parsed.projectName || charter.projectName,
            startDate: start, endDate: end,
            budgetHours: parsed.budgetHours, budgetCost: parsed.budgetCost, currency: parsed.currency,
            sections: parsed.sections, notes,
          };
          if (parsed.timorcCodes.length) timorcCodes = toTimorcCodes(parsed.timorcCodes);
          if (parsed.resources.length) resources = parsed.resources;
        } else {
          // Legacy charter card: label held the hours budget, notes were free text.
          charter = { ...charter, startDate: start, endDate: end, budgetHours: parseHoursLabel(labels), notes };
        }
      } else if (t === CARD_TIMORC) {
        legacyTimorc = `${notes}\n${labels}`.split(/\r?\n|;|,/).map((s) => s.trim()).filter(Boolean);
      } else if (t === CARD_RESOURCES) {
        legacyResources = parseResourcesLegacy(notes);
      }
      continue;
    }

    if (bucket && !seenBuckets.has(norm(bucket))) {
      seenBuckets.add(norm(bucket));
      orderedBuckets.push(bucket);
    }
    tasks.push({
      id: toText(cell(row, "id")) || hashId(`${planId}|${title}|${tasks.length}`),
      title,
      bucket: bucket || "Backlog",
      progressStatus: toText(cell(row, "progress")),
      priority: toPriority(cell(row, "priority")),
      assignee: toText(cell(row, "assignee")),
      startDate: toDate(cell(row, "start")),
      dueDate: toDate(cell(row, "due")),
      endDate: toDate(cell(row, "end")),
      overdue: norm(cell(row, "overdue")) === "true",
      labels,
      notes,
      estimateHours: parseEstimateHours(labels),
      progressPct: parseProgressPct(toText(cell(row, "checklist")), labels, notes),
    });
  }

  // Merge legacy cards for anything the charter card didn't provide.
  if (timorcCodes.length === 0 && legacyTimorc.length) timorcCodes = toTimorcCodes(legacyTimorc);
  if (resources.length === 0 && legacyResources.length) resources = legacyResources;

  charter.manager = resources.find((r) => /project manager|chef de projet|pm|manager/i.test(r.role))?.name ?? resources[0]?.name ?? "";
  charter.projectCode = timorcCodes[0]?.projectPrefix ?? charter.projectName;

  if (!charter.startDate || !charter.endDate) issues.push({ severity: "warning", scope: "Project Charter", message: "Charter start/end dates are missing — schedule and EVM will be limited." });
  if (charter.budgetHours == null && charter.budgetCost == null) issues.push({ severity: "warning", scope: "Project Charter", message: "No budget (hours or cost) found on the charter — budget/EVM will be limited." });
  if (timorcCodes.length === 0) issues.push({ severity: "warning", scope: "Taches Timorc", message: "No Timorc code found — time spent cannot be matched to this project." });
  if (tasks.length === 0) issues.push({ severity: "warning", scope: "Board", message: "No work tasks found in the buckets." });

  const project: Project = {
    id: hashId(`${planId}|${charter.projectName}`),
    charter, resources, timorcCodes,
    buckets: orderedBuckets.length > 0 ? orderedBuckets : ["Backlog"],
    tasks,
    meta: { sourceFileName: fileName, importedAt: new Date(), warningCount: issues.filter((i) => i.severity === "warning").length },
  };
  return { project, report: report(fileName, "board", issues) };
}

function emptyProject(fileName: string, planId: string, planName: string): Project {
  return {
    id: hashId(`${planId}|${planName}|${fileName}`),
    charter: { projectName: planName, projectCode: "", planId, startDate: null, endDate: null, budgetHours: null, budgetCost: null, currency: "", manager: "", sections: [], notes: "" },
    resources: [], timorcCodes: [], buckets: [], tasks: [],
    meta: { sourceFileName: fileName, importedAt: new Date(), warningCount: 0 },
  };
}

function report(fileName: string, kind: ValidationReport["kind"], issues: ValidationIssue[]): ValidationReport {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  return { fileName, kind, issues, errorCount, warningCount: issues.length - errorCount, valid: errorCount === 0 };
}
