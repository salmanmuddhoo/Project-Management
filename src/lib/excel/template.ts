/**
 * Standard workbook template generation (ExcelJS).
 *
 * The template is a *document*, not a raw grid: a titled Project Brief sheet
 * with colored section bands, a legend, and a clear visual split between
 * cells the manager fills in (blue) and cells the app calculates (grey,
 * locked, with a live formula where possible). Generated from the same
 * schema the parser and validator consume, so the two can never drift.
 *
 * `buildProjectWorkbook` also powers the sample-portfolio downloads.
 */

import ExcelJS from "exceljs";

import {
  BUDGET_COLUMNS,
  CHARTER_AUTO_FIELDS,
  CHARTER_FIELDS,
  DELIVERABLE_COLUMNS,
  ISSUE_COLUMNS,
  MILESTONE_COLUMNS,
  NARRATIVE_FIELDS,
  RISK_COLUMNS,
  SCOPE_FIELDS,
  SHEETS,
  TASK_COLUMNS,
  TEAM_COLUMNS,
  type ColumnDef,
} from "./schema";

// -- Palette (mirrors the app's brand + fill-in/auto convention) ------------
const BRAND = "FF1F3A5F"; // deep navy — banners & section bands
const BRAND_SOFT = "FF2A78D6"; // brand blue — table headers
const FILLIN_BG = "FFEAF2FD"; // light blue — YOU fill this in
const FILLIN_BORDER = "FF2A78D6";
const AUTO_BG = "FFECECEC"; // grey — calculated automatically
const AUTO_TEXT = "FF7A7A7A";
const LABEL_TEXT = "FF1F3A5F";
const WHITE = "FFFFFFFF";

const thin = (color: string): Partial<ExcelJS.Border> => ({ style: "thin", color: { argb: color } });

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Style a cell the manager should fill in (blue wash, blue left accent). */
function styleFillIn(cell: ExcelJS.Cell, numFmt?: string) {
  cell.fill = fill(FILLIN_BG);
  cell.border = {
    top: thin("FFD6E4F7"),
    bottom: thin("FFD6E4F7"),
    left: { style: "medium", color: { argb: FILLIN_BORDER } },
    right: thin("FFD6E4F7"),
  };
  cell.alignment = { vertical: "middle", wrapText: true };
  if (numFmt) cell.numFmt = numFmt;
}

/** Style a calculated cell (grey, italic, locked). */
function styleAuto(cell: ExcelJS.Cell, numFmt?: string) {
  cell.fill = fill(AUTO_BG);
  cell.font = { italic: true, color: { argb: AUTO_TEXT }, size: 10 };
  cell.border = {
    top: thin("FFDDDDDD"),
    bottom: thin("FFDDDDDD"),
    left: thin("FFDDDDDD"),
    right: thin("FFDDDDDD"),
  };
  cell.alignment = { vertical: "middle" };
  if (numFmt) cell.numFmt = numFmt;
}

function styleLabel(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: LABEL_TEXT }, size: 11 };
  cell.alignment = { vertical: "middle" };
}

const numFmtFor = (t: ColumnDef["type"]) =>
  t === "date" ? "yyyy-mm-dd" : t === "percent" ? '0"%"' : t === "number" ? "#,##0" : undefined;

// ---------------------------------------------------------------------------
// Data shape for a generated workbook
// ---------------------------------------------------------------------------

type Cell = string | number | Date | null;
export type SheetRows = Cell[][];

export interface WorkbookData {
  /** Charter + narrative field values, keyed by ColumnDef.key. */
  charter?: Record<string, Cell>;
  /** Scope field values (multi-line string per key). */
  scope?: Record<string, string>;
  milestones?: SheetRows;
  deliverables?: SheetRows;
  risks?: SheetRows;
  issues?: SheetRows;
  team?: SheetRows;
  budget?: SheetRows;
  tasks?: SheetRows;
}

const BRIEF_WIDTH = 6; // default band width (columns A–F)

// ---------------------------------------------------------------------------
// Brief sheet building blocks (width = how many columns bands/values span)
// ---------------------------------------------------------------------------

function banner(ws: ExcelJS.Worksheet, title: string, subtitle: string, width = BRIEF_WIDTH) {
  ws.mergeCells(1, 1, 1, width);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.fill = fill(BRAND);
  t.font = { bold: true, size: 20, color: { argb: WHITE } };
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 40;

  ws.mergeCells(2, 1, 2, width);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.fill = fill(BRAND);
  s.font = { size: 10, color: { argb: "FFB9CCE6" } };
  s.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(2).height = 18;
}

function legend(ws: ExcelJS.Worksheet, row: number, width = BRIEF_WIDTH) {
  ws.getCell(row, 1).value = "Legend:";
  ws.getCell(row, 1).font = { bold: true, size: 10, color: { argb: LABEL_TEXT } };
  const blue = ws.getCell(row, 2);
  blue.value = "  You fill this in";
  styleFillIn(blue);
  blue.font = { size: 10, color: { argb: LABEL_TEXT } };
  const grey = ws.getCell(row, 3);
  grey.value = "  Calculated automatically — leave blank";
  styleAuto(grey);
  ws.mergeCells(row, 3, row, Math.max(3, width));
}

function sectionBand(ws: ExcelJS.Worksheet, row: number, text: string, width = BRIEF_WIDTH) {
  ws.mergeCells(row, 1, row, width);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.fill = fill(BRAND);
  c.font = { bold: true, size: 12, color: { argb: WHITE } };
  c.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(row).height = 24;
}

/** Label in A, fill-in value merged across the remaining width. */
function keyValueRow(ws: ExcelJS.Worksheet, row: number, def: ColumnDef, value: Cell, width = BRIEF_WIDTH): number {
  const label = ws.getCell(row, 1);
  label.value = def.mandatory ? `${def.header} *` : def.header;
  styleLabel(label);
  ws.mergeCells(row, 2, row, width);
  const cell = ws.getCell(row, 2);
  cell.value = value ?? null;
  styleFillIn(cell, numFmtFor(def.type));
  ws.getRow(row).height = 20;
  return row + 1;
}

function autoRow(ws: ExcelJS.Worksheet, row: number, def: ColumnDef, width = BRIEF_WIDTH): number {
  const label = ws.getCell(row, 1);
  label.value = def.header;
  label.font = { bold: true, color: { argb: AUTO_TEXT }, size: 11 };
  ws.mergeCells(row, 2, row, width);
  const cell = ws.getCell(row, 2);
  cell.value = "— calculated by Portfolio PPM —";
  styleAuto(cell);
  ws.getRow(row).height = 20;
  return row + 1;
}

/** Label row + tall wrapped fill-in cell for narrative/scope text. */
function textBlock(ws: ExcelJS.Worksheet, row: number, def: ColumnDef, value: Cell, hint: string, width = BRIEF_WIDTH): number {
  const label = ws.getCell(row, 1);
  label.value = def.header;
  styleLabel(label);
  ws.mergeCells(row, 2, row, width);
  const cell = ws.getCell(row, 2);
  cell.value = (value as string) || null;
  styleFillIn(cell);
  cell.alignment = { vertical: "top", wrapText: true };
  if (!value) cell.note = hint;
  ws.getRow(row).height = 44;
  return row + 1;
}

/**
 * Section band + a table (colored header, styled fill-in rows, auto columns
 * with live formulas). The band spans the full table width. Returns the next
 * free row.
 */
function tableSection(
  ws: ExcelJS.Worksheet,
  row: number,
  title: string,
  columns: ColumnDef[],
  rows: SheetRows | undefined,
  guideRows: number,
): number {
  let r = sectionRow(ws, row, title, columns.length);

  const headerRow = ws.getRow(r);
  columns.forEach((def, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = def.auto ? `${def.header} (auto)` : def.mandatory ? `${def.header} *` : def.header;
    cell.fill = fill(def.auto ? AUTO_BG : BRAND_SOFT);
    cell.font = { bold: true, size: 10, color: { argb: def.auto ? AUTO_TEXT : WHITE } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  headerRow.height = 22;
  const headerIndex = r;
  r += 1;

  const dataRows: SheetRows = rows && rows.length > 0 ? rows : Array.from({ length: guideRows }, () => []);
  dataRows.forEach((data, di) => {
    const excelRow = r + di;
    const wsRow = ws.getRow(excelRow);
    columns.forEach((def, ci) => {
      const cell = wsRow.getCell(ci + 1);
      if (def.auto) {
        const formula = autoFormula(title, def.key, excelRow);
        if (formula) cell.value = { formula } as ExcelJS.CellFormulaValue;
        styleAuto(cell, numFmtFor(def.type));
      } else {
        cell.value = (data[ci] ?? null) as ExcelJS.CellValue;
        styleFillIn(cell, numFmtFor(def.type));
      }
    });
    wsRow.height = 18;
  });
  void headerIndex;
  return r + dataRows.length + 1;
}

function sectionRow(ws: ExcelJS.Worksheet, row: number, title: string, width = BRIEF_WIDTH): number {
  sectionBand(ws, row, title, width);
  return row + 1;
}

/** Live within-row formulas for the auto columns of the Team & Budget tables. */
function autoFormula(sectionTitle: string, key: string, row: number): string | null {
  if (sectionTitle.includes("TEAM")) {
    // Name A · Role B · Alloc C · Planned D · Actual E · Rate F · PC G · AC H · Util I
    if (key === "plannedCost") return `IF(F${row}="","",F${row}*D${row})`;
    if (key === "actualCost") return `IF(F${row}="","",F${row}*E${row})`;
    if (key === "utilization") return `IF(OR(D${row}="",D${row}=0),"",ROUND(E${row}/D${row}*100,0))`;
  }
  if (sectionTitle.includes("BUDGET")) {
    // Category A · Planned B · Actual C · Forecast D · Variance E
    if (key === "variance") return `IF(B${row}="","",B${row}-IF(D${row}="",C${row},D${row}))`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function buildBriefSheet(wb: ExcelJS.Workbook, data: WorkbookData) {
  const ws = wb.addWorksheet(SHEETS.brief, {
    properties: { defaultColWidth: 18 },
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 22;
  for (let i = 2; i <= BRIEF_WIDTH; i++) ws.getColumn(i).width = 18;

  banner(ws, "PROJECT BRIEF", "One page to define, plan and govern the project · Portfolio PPM standard template");
  let r = 4;
  legend(ws, r);
  r += 2;

  r = sectionRow(ws, r, "① PROJECT CHARTER");
  for (const def of CHARTER_FIELDS) {
    r = keyValueRow(ws, r, def, data.charter?.[def.key] ?? null);
  }
  for (const def of CHARTER_AUTO_FIELDS) {
    r = autoRow(ws, r, def);
  }
  r += 1;

  r = sectionRow(ws, r, "② PROJECT NARRATIVE");
  const hints: Record<string, string> = {
    description: "A short paragraph on what this project is.",
    businessNeed: "Why is this project needed now?",
    objectives: "What will be achieved? (measurable)",
    benefits: "The value delivered (financial or otherwise).",
  };
  for (const def of NARRATIVE_FIELDS) {
    r = textBlock(ws, r, def, data.charter?.[def.key] ?? null, hints[def.key] ?? "");
  }
  r += 1;

  r = sectionRow(ws, r, "③ SCOPE");
  const scopeHints: Record<string, string> = {
    inScope: "What is included (one item per line).",
    outOfScope: "What is explicitly excluded.",
    assumptions: "Assumptions the plan depends on.",
    constraints: "Constraints (time, budget, regulatory…).",
  };
  for (const def of SCOPE_FIELDS) {
    r = textBlock(ws, r, def, data.scope?.[def.key] ?? null, scopeHints[def.key] ?? "");
  }
  r += 1;

  r = tableSection(ws, r, "④ MILESTONES", MILESTONE_COLUMNS, data.milestones, 5);
  r = tableSection(ws, r, "⑤ DELIVERABLES", DELIVERABLE_COLUMNS, data.deliverables, 5);
  r = tableSection(ws, r, "⑥ RISKS", RISK_COLUMNS, data.risks, 4);
  r = tableSection(ws, r, "⑦ ISSUES", ISSUE_COLUMNS, data.issues, 3);
}

function buildTeamBudgetSheet(wb: ExcelJS.Workbook, data: WorkbookData) {
  const ws = wb.addWorksheet(SHEETS.teamBudget, {
    properties: { defaultColWidth: 16 },
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 22;
  const w = TEAM_COLUMNS.length;
  banner(ws, "TEAM & BUDGET", "Who is on the project, and where the money goes · grey columns calculate themselves", w);
  let r = 4;
  legend(ws, r, w);
  r += 2;
  r = tableSection(ws, r, "① TEAM", TEAM_COLUMNS, data.team, 6);
  r = tableSection(ws, r, "② BUDGET", BUDGET_COLUMNS, data.budget, 5);
}

function buildTasksSheet(wb: ExcelJS.Workbook, data: WorkbookData) {
  const ws = wb.addWorksheet(SHEETS.tasks, {
    properties: { defaultColWidth: 18 },
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 40;
  banner(ws, "TASKS", "A simple task list — Status drives the Kanban board (Backlog → Done)", TASK_COLUMNS.length);
  let r = 4;
  ws.getCell(r, 1).value = "Status options: Backlog · Ready · To Do · In Progress · Blocked · Review · Done";
  ws.getCell(r, 1).font = { italic: true, size: 10, color: { argb: AUTO_TEXT } };
  r += 2;
  tableSection(ws, r, "TASK LIST", TASK_COLUMNS, data.tasks, 8);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildProjectWorkbook(data: WorkbookData = {}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Portfolio PPM";
  wb.created = new Date();
  buildBriefSheet(wb, data);
  buildTeamBudgetSheet(wb, data);
  buildTasksSheet(wb, data);
  return wb;
}

export async function downloadWorkbook(wb: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadBlankTemplate(): Promise<void> {
  await downloadWorkbook(buildProjectWorkbook(), "Project-Brief-Template.xlsx");
}
