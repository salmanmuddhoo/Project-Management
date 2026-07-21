/**
 * Timorc time-tracking export parser (.csv or .xlsx).
 *
 * The export is one row per person per day per task code. Columns (French,
 * semicolon-delimited, Windows-1252 when CSV):
 *   Projet ; Intervenant ; Code tâche ; Tâche ; Sous-tâche ;
 *   Temps passé cumulé … ; Prestation ; Jour ; Temps passé ;
 *   Nb jours présence … ; Commentaire
 *
 * "Temps passé" is in man-days (0.25 = ¼ day). We keep only the daily rows
 * (Jour + Temps passé set) and skip the cumulative summary rows so hours are
 * never double-counted.
 */

import * as XLSX from "xlsx";

import type { TimeEntry, TimeImport } from "@/types/time";
import type { ValidationIssue, ValidationReport } from "@/types/validation";

const norm = (v: unknown) =>
  String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const COLS: Record<string, string[]> = {
  projet: ["projet", "project"],
  person: ["intervenant", "person", "resource", "utilisateur"],
  code: ["code tâche", "code tache", "task code", "code"],
  task: ["tâche", "tache", "task"],
  subTask: ["sous-tâche", "sous-tache", "sub-task", "subtask"],
  cumulative: ["temps passé cumulé", "temps passe cumule", "cumulative"],
  day: ["jour", "day", "date"],
  spent: ["temps passé", "temps passe", "time spent", "spent"],
  comment: ["commentaire", "comment", "note"],
};

/** Resolve a header row to column indices; "tâche" must not steal "code tâche"/"sous-tâche". */
function resolveColumns(header: unknown[]): Record<string, number> {
  const normalized = header.map((h) => norm(h));
  const map: Record<string, number> = {};
  const order = ["projet", "person", "code", "subTask", "task", "cumulative", "day", "spent", "comment"];
  const used = new Set<number>();
  for (const key of order) {
    const aliases = COLS[key];
    const idx = normalized.findIndex(
      (h, i) => !used.has(i) && aliases.some((a) => h === a || h.startsWith(a)),
    );
    if (idx >= 0) {
      map[key] = idx;
      used.add(idx);
    }
  }
  return map;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86_400_000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/.exec(String(v).trim());
  if (m) {
    const year = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const d = new Date(Date.UTC(year, +m[2] - 1, +m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(v).trim());
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  return null;
}

/** Minimal CSV line splitter (handles quoted fields and a chosen delimiter). */
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function gridFromCsv(buffer: ArrayBuffer): unknown[][] {
  // Timorc CSV is Windows-1252; decode accordingly (accents matter).
  const text = new TextDecoder("windows-1252").decode(buffer).replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const delim = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  return lines.map((l) => splitCsvLine(l, delim));
}

function gridFromXlsx(buffer: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: null,
    blankrows: false,
  });
}

export function looksLikeTimeGrid(grid: unknown[][]): boolean {
  const header = (grid[0] ?? []).map((h) => norm(h));
  const has = (aliases: string[]) => header.some((h) => aliases.some((a) => h.startsWith(a)));
  return has(COLS.person) && has(COLS.spent) && has(COLS.projet);
}

export function parseTimeFile(fileName: string, buffer: ArrayBuffer): {
  timeImport: TimeImport;
  report: ValidationReport;
} {
  const isCsv = /\.(csv|tsv|txt)$/i.test(fileName);
  const grid = isCsv ? gridFromCsv(buffer) : gridFromXlsx(buffer);
  const issues: ValidationIssue[] = [];

  if (grid.length < 2 || !looksLikeTimeGrid(grid)) {
    issues.push({
      severity: "error",
      scope: "Time file",
      message: "Not recognised as a Timorc time export (expected Projet / Intervenant / Temps passé columns).",
    });
    return {
      timeImport: { fileName, entries: [], skipped: 0 },
      report: buildReport(fileName, "time", issues),
    };
  }

  const cols = resolveColumns(grid[0]);
  const cell = (row: unknown[], key: string) => (cols[key] != null ? row[cols[key]] : null);
  const entries: TimeEntry[] = [];
  let skipped = 0;

  for (const row of grid.slice(1)) {
    const day = toDate(cell(row, "day"));
    const days = toNumber(cell(row, "spent"));
    // Keep only daily rows; cumulative summary rows have no Jour.
    if (!day || days == null) {
      skipped++;
      continue;
    }
    const projet = String(cell(row, "projet") ?? "").trim();
    const code = String(cell(row, "code") ?? "").trim();
    entries.push({
      projet,
      projectPrefix: projet.split(/\s*-\s*/)[0]?.trim() ?? projet,
      person: String(cell(row, "person") ?? "").trim(),
      code,
      task: String(cell(row, "task") ?? "").trim(),
      subTask: String(cell(row, "subTask") ?? "").trim(),
      date: day,
      days,
      comment: String(cell(row, "comment") ?? "").trim(),
      sourceFile: fileName,
    });
  }

  if (entries.length === 0) {
    issues.push({ severity: "error", scope: "Time file", message: "No daily time entries found." });
  }
  return {
    timeImport: { fileName, entries, skipped },
    report: buildReport(fileName, "time", issues),
  };
}

function buildReport(
  fileName: string,
  kind: ValidationReport["kind"],
  issues: ValidationIssue[],
): ValidationReport {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  return {
    fileName,
    kind,
    issues,
    errorCount,
    warningCount: issues.length - errorCount,
    valid: errorCount === 0,
  };
}
