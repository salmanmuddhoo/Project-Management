/**
 * Workbook parsing: SheetJS → RawWorkbook → typed Project.
 *
 *  1. `readWorkbook` extracts a `RawWorkbook` (coerced cell values + row
 *     coordinates) without judging validity.
 *  2. `validateWorkbook` (separate module) inspects it and produces the
 *     validation report shown before import.
 *  3. `buildProject` turns a RawWorkbook into the typed domain object.
 *
 * The "Project Brief" sheet is a document — charter key/values, scope
 * key/values and four stacked tables — so tables are located by scanning
 * column A for each table's identifying header rather than by fixed rows.
 *
 * Everything runs in the browser; the file never leaves the machine.
 */

import * as XLSX from "xlsx";

import type {
  BudgetLine,
  Deliverable,
  Issue,
  KanbanColumn,
  Milestone,
  Project,
  ProjectCharter,
  Risk,
  ScopeDefinition,
  Task,
  TeamMember,
} from "@/types/project";
import { KANBAN_COLUMNS } from "@/types/project";
import type { ValidationIssue } from "@/types/validation";
import { hashId } from "@/lib/utils";
import {
  CHARTER_FIELDS,
  NARRATIVE_FIELDS,
  SCOPE_FIELDS,
  SHEETS,
  TABLE_MARKERS,
  TABLE_SPECS,
  normalizeHeader,
  type ColumnDef,
  type SheetKey,
  type TableSpec,
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
  /** Whether the table's header row was found on its sheet at all. */
  found: boolean;
  missingColumns: string[];
}

export interface RawWorkbook {
  fileName: string;
  presentSheets: SheetKey[];
  charter: Record<string, unknown>;
  scope: Record<string, string[]>;
  tables: Record<TableSpec["key"], ParsedTable>;
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

/** Percent cells: Excel fractions (0.45) → 45; plain numbers pass through. */
function toPercent(value: unknown): number | null {
  const raw = typeof value === "string" ? value.replace("%", "").trim() : value;
  const num = toNumber(raw);
  if (num == null) return null;
  const hadSign = typeof value === "string" && value.includes("%");
  return !hadSign && num <= 1 && num >= 0 ? num * 100 : num;
}

function serialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86_400_000));
}

const TEXT_DATE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/;

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
    const ok =
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === m - 1 &&
      date.getUTCDate() === d;
    return ok ? { date, invalid: false } : { date: null, invalid: true };
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
// Sheet helpers
// ---------------------------------------------------------------------------

type Grid = unknown[][];

function findSheet(wb: XLSX.WorkBook, displayName: string): string | null {
  const wanted = normalizeHeader(displayName);
  return wb.SheetNames.find((n) => normalizeHeader(n) === wanted) ?? null;
}

function gridOf(ws: XLSX.WorkSheet): Grid {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    blankrows: true,
  });
}

/**
 * Build a label→value map from any column-A / column-B pairs on a sheet.
 * Used for the charter and scope key/value blocks. Repeated keys (multi-line
 * scope entered as separate rows) are concatenated with newlines.
 */
function keyValueMap(grid: Grid): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const row of grid) {
    const key = normalizeHeader(row?.[0]);
    if (!key) continue;
    const value = row?.[1] ?? null;
    if (map.has(key)) {
      map.set(key, `${toText(map.get(key))}\n${toText(value)}`.trim());
    } else {
      map.set(key, value);
    }
  }
  return map;
}

const STOP_MARKERS = new Set(TABLE_MARKERS.map((m) => normalizeHeader(m)));

/**
 * Locate a table by its first-column header anywhere on the grid, then read
 * data rows until a blank row or the start of another known table.
 */
function extractTable(
  grid: Grid,
  spec: TableSpec,
  sheetName: string,
  issues: ValidationIssue[],
): ParsedTable {
  const firstHeader = normalizeHeader(spec.columns[0].header);
  const headerRowIndex = grid.findIndex(
    (row) => normalizeHeader(row?.[0]) === firstHeader,
  );
  if (headerRowIndex < 0) {
    return { rows: [], found: false, missingColumns: [] };
  }

  const headerRow = grid[headerRowIndex] ?? [];
  const indexByKey = new Map<string, number>();
  for (const def of spec.columns) {
    const idx = headerRow.findIndex(
      (h) => normalizeHeader(h) === normalizeHeader(def.header),
    );
    if (idx >= 0) indexByKey.set(def.key, idx);
  }
  const missingColumns = spec.columns
    .filter((c) => !c.auto && !indexByKey.has(c.key))
    .map((c) => c.header);

  const rows: ParsedRow[] = [];
  for (let i = headerRowIndex + 1; i < grid.length; i++) {
    const raw = grid[i];
    const firstCell = normalizeHeader(raw?.[0]);
    // Stop at the next table's header row.
    if (firstCell && STOP_MARKERS.has(firstCell) && firstCell !== firstHeader) {
      break;
    }
    const blank =
      !raw || raw.every((c) => c == null || String(c).trim() === "");
    if (blank) break;

    const excelRow = i + 1;
    const values: Record<string, unknown> = {};
    for (const def of spec.columns) {
      if (def.auto) continue; // calculated on import, never read
      const idx = indexByKey.get(def.key);
      const cell = idx == null ? null : raw[idx];
      values[def.key] = coerceCell(cell, def, sheetName, excelRow, issues);
    }
    rows.push({ rowNumber: excelRow, values });
  }
  return { rows, found: true, missingColumns };
}

function emptyTable(): ParsedTable {
  return { rows: [], found: false, missingColumns: [] };
}

/** An empty tables record (used as a fallback when a file cannot be read). */
export function emptyTables(): RawWorkbook["tables"] {
  const tables = {} as RawWorkbook["tables"];
  for (const spec of TABLE_SPECS) tables[spec.key] = emptyTable();
  return tables;
}

// ---------------------------------------------------------------------------
// Public API — stage 1: read
// ---------------------------------------------------------------------------

export async function readWorkbook(file: File): Promise<RawWorkbook> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  const coercionIssues: ValidationIssue[] = [];
  const presentSheets: SheetKey[] = [];
  const grids = new Map<SheetKey, Grid>();
  for (const key of Object.keys(SHEETS) as SheetKey[]) {
    const sheetName = findSheet(wb, SHEETS[key]);
    if (sheetName) {
      presentSheets.push(key);
      grids.set(key, gridOf(wb.Sheets[sheetName]));
    }
  }

  // Charter + scope from the Brief key/value pairs.
  const briefGrid = grids.get("brief") ?? [];
  const kv = keyValueMap(briefGrid);
  const charter: Record<string, unknown> = {};
  for (const field of [...CHARTER_FIELDS, ...NARRATIVE_FIELDS]) {
    charter[field.key] = coerceCell(
      kv.get(normalizeHeader(field.header)),
      field,
      SHEETS.brief,
      0,
      coercionIssues,
    );
  }
  const scope: Record<string, string[]> = {};
  for (const field of SCOPE_FIELDS) {
    scope[field.key] = toText(kv.get(normalizeHeader(field.header)))
      .split(/\r?\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Tables (each on its designated sheet).
  const tables = {} as RawWorkbook["tables"];
  for (const spec of TABLE_SPECS) {
    const grid = grids.get(spec.sheet);
    tables[spec.key] = grid
      ? extractTable(grid, spec, SHEETS[spec.sheet], coercionIssues)
      : emptyTable();
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
const KANBAN_ALIASES: Record<string, KanbanColumn> = {
  todo: "To Do",
  "to-do": "To Do",
  open: "To Do",
  new: "Backlog",
  doing: "In Progress",
  wip: "In Progress",
  "in review": "Review",
  testing: "Review",
  qa: "Review",
  closed: "Done",
  complete: "Done",
  completed: "Done",
  resolved: "Done",
};

export function toKanbanColumn(status: string): KanbanColumn {
  const norm = normalizeHeader(status);
  return KANBAN_LOOKUP.get(norm) ?? KANBAN_ALIASES[norm] ?? "Backlog";
}

function rowsOf(raw: RawWorkbook, key: TableSpec["key"]): Record<string, unknown>[] {
  return raw.tables[key].rows.map((r) => r.values);
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
    fundingType: (c.fundingType as ProjectCharter["fundingType"]) ?? "",
    budget: c.budget as number | null,
    plannedStartDate: c.plannedStartDate as Date | null,
    plannedEndDate: c.plannedEndDate as Date | null,
    actualStartDate: c.actualStartDate as Date | null,
    description: c.description as string,
    businessNeed: c.businessNeed as string,
    objectives: c.objectives as string,
    benefits: c.benefits as string,
  };

  const scope: ScopeDefinition = {
    inScope: raw.scope.inScope ?? [],
    outOfScope: raw.scope.outOfScope ?? [],
    assumptions: raw.scope.assumptions ?? [],
    constraints: raw.scope.constraints ?? [],
  };

  const tasks: Task[] = rowsOf(raw, "tasks").map((v, i) => ({
    id: `T${i + 1}`,
    title: v.title as string,
    owner: v.owner as string,
    priority: (v.priority as Task["priority"]) ?? "",
    dueDate: v.dueDate as Date | null,
    status: toKanbanColumn(String(v.status ?? "")),
  }));

  return {
    id: hashId(`${charter.projectCode}|${charter.projectName}|${raw.fileName}`),
    charter,
    scope,
    milestones: rowsOf(raw, "milestones") as unknown as Milestone[],
    deliverables: rowsOf(raw, "deliverables") as unknown as Deliverable[],
    risks: rowsOf(raw, "risks") as unknown as Risk[],
    issues: rowsOf(raw, "issues") as unknown as Issue[],
    team: rowsOf(raw, "team") as unknown as TeamMember[],
    budget: rowsOf(raw, "budget") as unknown as BudgetLine[],
    tasks,
    meta: {
      sourceFileName: raw.fileName,
      importedAt: new Date(),
      warningCount,
    },
  };
}
