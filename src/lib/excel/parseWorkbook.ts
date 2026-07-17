/**
 * Workbook parsing: SheetJS → RawWorkbook → typed Project.
 *
 * Parsing is deliberately split in two stages:
 *  1. `readWorkbook` extracts a `RawWorkbook` (coerced cell values + row
 *     coordinates + anything that failed coercion) without judging validity.
 *  2. `validateWorkbook` (separate module) inspects the RawWorkbook and
 *     produces the validation report shown to the user.
 *  3. `buildProject` turns a RawWorkbook into the typed domain object once
 *     the user confirms the import.
 *
 * Everything runs in the browser; the file never leaves the machine.
 */

import * as XLSX from "xlsx";

import type {
  BacklogItem,
  BudgetLine,
  ExpectedOutput,
  Issue,
  KanbanColumn,
  Milestone,
  Project,
  ProjectCharter,
  ResourcePlan,
  Risk,
  ScopeDefinition,
  Sprint,
  TimeEntry,
} from "@/types/project";
import { KANBAN_COLUMNS } from "@/types/project";
import type { ValidationIssue } from "@/types/validation";
import { hashId } from "@/lib/utils";
import {
  CHARTER_FIELDS,
  SCOPE_FIELDS,
  SHEETS,
  TABULAR_SHEETS,
  normalizeHeader,
  type ColumnDef,
  type SheetKey,
} from "./schema";

// ---------------------------------------------------------------------------
// Raw representation
// ---------------------------------------------------------------------------

export interface ParsedRow {
  /** 1-based Excel row number (for validation messages). */
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface ParsedTable {
  rows: ParsedRow[];
  /** Template headers that could not be found on the sheet. */
  missingColumns: string[];
}

export interface RawWorkbook {
  fileName: string;
  /** Sheet keys that are present in the file. */
  presentSheets: SheetKey[];
  charter: Record<string, unknown>;
  scope: Record<string, string[]>;
  tables: Partial<Record<SheetKey, ParsedTable>>;
  /** Issues discovered while coercing cells (bad dates, bad numbers). */
  coercionIssues: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// Cell coercion
// ---------------------------------------------------------------------------

function toText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[\s,$€£]/g, "");
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Percent cells arrive either as Excel fractions (0.45) or plain numbers
 * (45). Values ≤ 1 are treated as fractions; the result is always 0–100.
 */
function toPercent(value: unknown): number | null {
  const raw =
    typeof value === "string" ? value.replace("%", "").trim() : value;
  const num = toNumber(raw);
  if (num == null) return null;
  const hadPercentSign = typeof value === "string" && value.includes("%");
  return !hadPercentSign && num <= 1 && num >= 0 ? num * 100 : num;
}

/** Excel serial date origin (1900 system, as SheetJS uses). */
function serialToDate(serial: number): Date {
  const utcDays = serial - 25569;
  return new Date(Math.round(utcDays * 86_400_000));
}

const TEXT_DATE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/;

/**
 * Accepts native Date cells, Excel serials and common text formats
 * (YYYY-MM-DD, DD/MM/YYYY). Returns `invalid` when the cell holds something
 * that clearly intends to be a date but cannot be read.
 */
function toDate(value: unknown): { date: Date | null; invalid: boolean } {
  if (value == null || value === "") return { date: null, invalid: false };
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { date: null, invalid: true }
      : { date: value, invalid: false };
  }
  if (typeof value === "number") {
    if (value < 1 || value > 2_958_465) return { date: null, invalid: true };
    return { date: serialToDate(value), invalid: false };
  }
  const text = String(value).trim();
  const match = TEXT_DATE.exec(text);
  if (match) {
    const [y, m, d] = match[1]
      ? [Number(match[1]), Number(match[2]), Number(match[3])]
      : [Number(match[6]), Number(match[5]), Number(match[4])];
    const date = new Date(Date.UTC(y, m - 1, d));
    const roundTrips =
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === m - 1 &&
      date.getUTCDate() === d;
    return roundTrips ? { date, invalid: false } : { date: null, invalid: true };
  }
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime())
    ? { date: null, invalid: true }
    : { date: fallback, invalid: false };
}

function coerceCell(
  value: unknown,
  def: ColumnDef,
  sheet: string,
  rowNumber: number,
  issues: ValidationIssue[],
): unknown {
  switch (def.type) {
    case "text":
      return toText(value);
    case "number": {
      const num = toNumber(value);
      if (num == null && value != null && String(value).trim() !== "") {
        issues.push({
          severity: "warning",
          sheet,
          row: rowNumber,
          column: def.header,
          message: `"${String(value)}" is not a number and was ignored.`,
        });
      }
      return num;
    }
    case "percent":
      return toPercent(value);
    case "date": {
      const { date, invalid } = toDate(value);
      if (invalid) {
        issues.push({
          severity: "error",
          sheet,
          row: rowNumber,
          column: def.header,
          message: `"${String(value)}" is not a valid date (use YYYY-MM-DD).`,
        });
      }
      return date;
    }
  }
}

// ---------------------------------------------------------------------------
// Sheet extraction
// ---------------------------------------------------------------------------

function findSheet(wb: XLSX.WorkBook, displayName: string): string | null {
  const wanted = normalizeHeader(displayName);
  return wb.SheetNames.find((n) => normalizeHeader(n) === wanted) ?? null;
}

/** Key/value sheets (Charter, Scope): column A = field, column B = value. */
function readKeyValueSheet(
  ws: XLSX.WorkSheet,
): Map<string, unknown> {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    blankrows: false,
  });
  const map = new Map<string, unknown>();
  for (const row of rows) {
    const key = normalizeHeader(row[0]);
    if (!key) continue;
    // Keep the first occurrence; append for repeated Scope-style keys.
    if (map.has(key)) {
      const existing = map.get(key);
      map.set(key, `${toText(existing)}\n${toText(row[1])}`);
    } else {
      map.set(key, row[1]);
    }
  }
  return map;
}

function readTable(
  ws: XLSX.WorkSheet,
  columns: ColumnDef[],
  sheetName: string,
  issues: ValidationIssue[],
): ParsedTable {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    blankrows: true,
  });
  const headerRow = grid[0] ?? [];
  const indexByKey = new Map<string, number>();
  for (const def of columns) {
    const idx = headerRow.findIndex(
      (h) => normalizeHeader(h) === normalizeHeader(def.header),
    );
    if (idx >= 0) indexByKey.set(def.key, idx);
  }
  const missingColumns = columns
    .filter((c) => !indexByKey.has(c.key))
    .map((c) => c.header);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const excelRow = i + 1;
    const raw = grid[i];
    if (!raw || raw.every((c) => c == null || String(c).trim() === "")) {
      continue;
    }
    const values: Record<string, unknown> = {};
    for (const def of columns) {
      const idx = indexByKey.get(def.key);
      const cell = idx == null ? null : raw[idx];
      values[def.key] = coerceCell(cell, def, sheetName, excelRow, issues);
    }
    rows.push({ rowNumber: excelRow, values });
  }
  return { rows, missingColumns };
}

// ---------------------------------------------------------------------------
// Public API — stage 1: read
// ---------------------------------------------------------------------------

export async function readWorkbook(file: File): Promise<RawWorkbook> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  const coercionIssues: ValidationIssue[] = [];
  const presentSheets: SheetKey[] = [];
  const tables: Partial<Record<SheetKey, ParsedTable>> = {};
  let charter: Record<string, unknown> = {};
  let scope: Record<string, string[]> = {};

  for (const key of Object.keys(SHEETS) as SheetKey[]) {
    const sheetName = findSheet(wb, SHEETS[key]);
    if (!sheetName) continue;
    presentSheets.push(key);
    const ws = wb.Sheets[sheetName];

    if (key === "charter") {
      const kv = readKeyValueSheet(ws);
      charter = {};
      for (const field of CHARTER_FIELDS) {
        const raw = kv.get(normalizeHeader(field.header));
        charter[field.key] = coerceCell(
          raw,
          field,
          SHEETS.charter,
          0,
          coercionIssues,
        );
      }
    } else if (key === "scope") {
      const kv = readKeyValueSheet(ws);
      scope = {};
      for (const field of SCOPE_FIELDS) {
        const raw = toText(kv.get(normalizeHeader(field.header)));
        scope[field.key] = raw
          .split(/\r?\n|;/) // one item per line (or semicolon-separated)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else {
      const columns = TABULAR_SHEETS[key];
      if (columns) {
        tables[key] = readTable(ws, columns, SHEETS[key], coercionIssues);
      }
    }
  }

  return {
    fileName: file.name,
    presentSheets,
    charter,
    scope,
    tables,
    coercionIssues,
  };
}

// ---------------------------------------------------------------------------
// Public API — stage 2: build the typed project
// ---------------------------------------------------------------------------

const KANBAN_LOOKUP = new Map<string, KanbanColumn>(
  KANBAN_COLUMNS.map((c) => [normalizeHeader(c), c]),
);
// Common aliases coming from Jira/DevOps exports.
const KANBAN_ALIASES: Record<string, KanbanColumn> = {
  todo: "To Do",
  "to-do": "To Do",
  open: "To Do",
  new: "Backlog",
  doing: "In Progress",
  wip: "In Progress",
  "in review": "Review",
  "code review": "Review",
  qa: "Testing",
  test: "Testing",
  closed: "Done",
  complete: "Done",
  completed: "Done",
  resolved: "Done",
};

export function toKanbanColumn(status: string): KanbanColumn {
  const norm = normalizeHeader(status);
  return KANBAN_LOOKUP.get(norm) ?? KANBAN_ALIASES[norm] ?? "Backlog";
}

function rowsOf(raw: RawWorkbook, key: SheetKey): Record<string, unknown>[] {
  return (raw.tables[key]?.rows ?? []).map((r) => r.values);
}

export function buildProject(raw: RawWorkbook, warningCount: number): Project {
  const c = raw.charter;
  const charter: ProjectCharter = {
    projectName: c.projectName as string,
    projectCode: c.projectCode as string,
    businessUnit: c.businessUnit as string,
    projectManager: c.projectManager as string,
    sponsor: c.sponsor as string,
    priority: (c.priority as ProjectCharter["priority"]) ?? "",
    status: (c.status as ProjectCharter["status"]) ?? "",
    currentPhase: (c.currentPhase as ProjectCharter["currentPhase"]) ?? "",
    description: c.description as string,
    businessNeed: c.businessNeed as string,
    objectives: c.objectives as string,
    benefits: c.benefits as string,
    fundingType: (c.fundingType as ProjectCharter["fundingType"]) ?? "",
    budget: c.budget as number | null,
    fundingAmount: c.fundingAmount as number | null,
    plannedStartDate: c.plannedStartDate as Date | null,
    plannedEndDate: c.plannedEndDate as Date | null,
    actualStartDate: c.actualStartDate as Date | null,
    forecastEndDate: c.forecastEndDate as Date | null,
    currentProgressPct: c.currentProgressPct as number | null,
    overallHealth: (c.overallHealth as ProjectCharter["overallHealth"]) ?? "",
  };

  const scope: ScopeDefinition = {
    deliverables: raw.scope.deliverables ?? [],
    outOfScope: raw.scope.outOfScope ?? [],
    successCriteria: raw.scope.successCriteria ?? [],
    dependencies: raw.scope.dependencies ?? [],
    constraints: raw.scope.constraints ?? [],
    assumptions: raw.scope.assumptions ?? [],
  };

  const backlog = rowsOf(raw, "backlog").map((v) => ({
    ...(v as unknown as BacklogItem),
    status: toKanbanColumn(String(v.status ?? "")),
  }));

  // Budget variance is always recomputed: Planned − Forecast (fallback Actual).
  const budget = rowsOf(raw, "budget").map((v) => {
    const line = v as unknown as BudgetLine;
    const basis = line.forecast ?? line.actual;
    return {
      ...line,
      variance:
        line.planned != null && basis != null ? line.planned - basis : null,
    };
  });

  return {
    id: hashId(`${charter.projectCode}|${charter.projectName}|${raw.fileName}`),
    charter,
    outputs: rowsOf(raw, "outputs") as unknown as ExpectedOutput[],
    scope,
    milestones: rowsOf(raw, "milestones") as unknown as Milestone[],
    resources: rowsOf(raw, "resources") as unknown as ResourcePlan[],
    budget,
    risks: rowsOf(raw, "risks") as unknown as Risk[],
    issues: rowsOf(raw, "issues") as unknown as Issue[],
    backlog,
    timeTracking: rowsOf(raw, "timeTracking") as unknown as TimeEntry[],
    sprints: rowsOf(raw, "sprints") as unknown as Sprint[],
    meta: {
      sourceFileName: raw.fileName,
      importedAt: new Date(),
      warningCount,
    },
  };
}
