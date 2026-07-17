/**
 * Standard workbook template generation (ExcelJS).
 *
 * The template is generated from the same schema the parser and validator
 * consume, so a downloaded template always matches what the importer
 * accepts. `writeProjectWorkbook` also powers the sample-data downloads.
 */

import ExcelJS from "exceljs";

import {
  BACKLOG_COLUMNS,
  BUDGET_COLUMNS,
  CHARTER_FIELDS,
  ISSUE_COLUMNS,
  MILESTONE_COLUMNS,
  OUTPUT_COLUMNS,
  RESOURCE_COLUMNS,
  RISK_COLUMNS,
  SCOPE_FIELDS,
  SHEETS,
  SPRINT_COLUMNS,
  TIME_COLUMNS,
  type ColumnDef,
} from "./schema";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F3A5F" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
};
const MANDATORY_MARK = " *";

/** Data for one sheet: rows of cell values in template column order. */
export type SheetRows = Array<Array<string | number | Date | null>>;

export interface WorkbookData {
  charter?: Partial<Record<string, string | number | Date | null>>;
  scope?: Partial<Record<string, string>>;
  outputs?: SheetRows;
  milestones?: SheetRows;
  resources?: SheetRows;
  budget?: SheetRows;
  risks?: SheetRows;
  issues?: SheetRows;
  backlog?: SheetRows;
  timeTracking?: SheetRows;
  sprints?: SheetRows;
}

function addKeyValueSheet(
  wb: ExcelJS.Workbook,
  name: string,
  fields: ColumnDef[],
  values: Partial<Record<string, string | number | Date | null>> = {},
  valueHeader = "Value",
) {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 26 }, { width: 70 }];
  const header = ws.addRow(["Field", valueHeader]);
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
  for (const field of fields) {
    const label = field.mandatory
      ? field.header + MANDATORY_MARK
      : field.header;
    const row = ws.addRow([field.header, values[field.key] ?? null]);
    row.getCell(1).font = { bold: field.mandatory };
    row.getCell(1).value = label;
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    if (field.type === "date") row.getCell(2).numFmt = "yyyy-mm-dd";
    if (field.type === "number") row.getCell(2).numFmt = "#,##0.00";
  }
  ws.getColumn(1).font = undefined; // per-row fonts already applied
}

function addTableSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: ColumnDef[],
  rows: SheetRows = [],
) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({
    width: Math.max(14, Math.min(40, c.header.length + 6)),
  }));
  const header = ws.addRow(
    columns.map((c) => (c.mandatory ? c.header + MANDATORY_MARK : c.header)),
  );
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of rows) {
    const added = ws.addRow(row);
    columns.forEach((c, i) => {
      if (c.type === "date") added.getCell(i + 1).numFmt = "yyyy-mm-dd";
    });
  }
}

/**
 * The header row must read exactly as the schema defines it — the mandatory
 * asterisk is cosmetic, so the parser strips it. Keep normalizeHeader in
 * schema.ts in mind if this convention ever changes.
 */
export function buildProjectWorkbook(data: WorkbookData = {}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Portfolio PPM";
  wb.created = new Date();

  addKeyValueSheet(wb, SHEETS.charter, CHARTER_FIELDS, data.charter);
  addTableSheet(wb, SHEETS.outputs, OUTPUT_COLUMNS, data.outputs);
  addKeyValueSheet(
    wb,
    SHEETS.scope,
    SCOPE_FIELDS,
    data.scope,
    "Items (one per line)",
  );
  addTableSheet(wb, SHEETS.milestones, MILESTONE_COLUMNS, data.milestones);
  addTableSheet(wb, SHEETS.resources, RESOURCE_COLUMNS, data.resources);
  addTableSheet(wb, SHEETS.budget, BUDGET_COLUMNS, data.budget);
  addTableSheet(wb, SHEETS.risks, RISK_COLUMNS, data.risks);
  addTableSheet(wb, SHEETS.issues, ISSUE_COLUMNS, data.issues);
  addTableSheet(wb, SHEETS.backlog, BACKLOG_COLUMNS, data.backlog);
  addTableSheet(wb, SHEETS.timeTracking, TIME_COLUMNS, data.timeTracking);
  addTableSheet(wb, SHEETS.sprints, SPRINT_COLUMNS, data.sprints);
  return wb;
}

export async function downloadWorkbook(
  wb: ExcelJS.Workbook,
  fileName: string,
): Promise<void> {
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
  await downloadWorkbook(
    buildProjectWorkbook(),
    "Project-Workbook-Template.xlsx",
  );
}
