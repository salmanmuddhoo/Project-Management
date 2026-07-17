/**
 * Validation engine — runs on the RawWorkbook BEFORE anything enters the
 * portfolio. Errors block import; warnings are shown but importable.
 *
 *   1. Structure   — the Project Brief sheet & its tables exist
 *   2. Charter     — mandatory fields, date sanity, non-negative budget
 *   3. Row-level   — mandatory cells, duplicate names, bad values
 *   4. Cross-sheet — budget consistency, over-allocation
 */

import type { RawWorkbook } from "@/lib/excel/parseWorkbook";
import {
  SHEETS,
  TABLE_SPECS,
  type SheetKey,
  type TableSpec,
} from "@/lib/excel/schema";
import type { ValidationIssue, ValidationReport } from "@/types/validation";

export function validateWorkbook(raw: RawWorkbook): ValidationReport {
  const issues: ValidationIssue[] = [...raw.coercionIssues];
  const present = new Set(raw.presentSheets);

  // -- 1. Structure ---------------------------------------------------------
  if (!present.has("brief")) {
    issues.push({
      severity: "error",
      sheet: "Workbook",
      message: `Required worksheet "${SHEETS.brief}" is missing.`,
    });
  }
  for (const spec of TABLE_SPECS) {
    const table = raw.tables[spec.key];
    if (!table.found) continue; // whole-table absence handled below where needed
    for (const header of table.missingColumns) {
      issues.push({
        severity: "error",
        sheet: SHEETS[spec.sheet],
        message: `The ${spec.key} table is missing its "${header}" column.`,
      });
    }
  }
  // Brief tables the framework expects to see at all.
  requireTable(raw, "milestones", "warning", issues);
  requireTable(raw, "deliverables", "error", issues);

  if (present.has("brief")) validateCharter(raw, issues);
  validateRows(raw, issues);
  validateCrossSheet(raw, issues);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  return {
    fileName: raw.fileName,
    issues: sortIssues(issues),
    errorCount,
    warningCount: issues.length - errorCount,
    valid: errorCount === 0,
  };
}

// ---------------------------------------------------------------------------

function requireTable(
  raw: RawWorkbook,
  key: TableSpec["key"],
  severity: "error" | "warning",
  issues: ValidationIssue[],
) {
  const spec = TABLE_SPECS.find((t) => t.key === key)!;
  if (raw.tables[key].rows.length === 0) {
    issues.push({
      severity,
      sheet: SHEETS[spec.sheet],
      message:
        severity === "error"
          ? `No ${key} recorded — add at least one row to the ${spec.columns[0].header} table.`
          : `No ${key} recorded yet.`,
    });
  }
}

function validateCharter(raw: RawWorkbook, issues: ValidationIssue[]) {
  const sheet = SHEETS.brief;
  const c = raw.charter;

  for (const [key, label] of [
    ["projectName", "Project Name"],
    ["projectCode", "Project Code"],
    ["projectManager", "Project Manager"],
  ] as const) {
    if (!String(c[key] ?? "").trim()) {
      issues.push({
        severity: "error",
        sheet,
        column: label,
        message: `Mandatory field "${label}" is empty.`,
      });
    }
  }

  if (!String(c.sponsor ?? "").trim()) {
    issues.push({
      severity: "warning",
      sheet,
      column: "Sponsor",
      message:
        "No sponsor assigned — the project will be flagged in governance checks and recommendations.",
    });
  }

  const budget = c.budget as number | null;
  if (budget == null) {
    issues.push({ severity: "error", sheet, column: "Budget", message: 'Mandatory field "Budget" is empty.' });
  } else if (budget < 0) {
    issues.push({ severity: "error", sheet, column: "Budget", message: `Budget cannot be negative (${budget}).` });
  }

  const start = c.plannedStartDate as Date | null;
  const end = c.plannedEndDate as Date | null;
  if (!start) {
    issues.push({ severity: "error", sheet, column: "Start Date", message: "Start Date is missing." });
  }
  if (!end) {
    issues.push({ severity: "error", sheet, column: "Target End Date", message: "Target End Date is missing." });
  }
  if (start && end && start.getTime() > end.getTime()) {
    issues.push({ severity: "error", sheet, message: "Start Date is after the Target End Date." });
  }

  for (const [key, label] of [
    ["businessUnit", "Business Unit"],
    ["priority", "Priority"],
    ["status", "Status"],
    ["currentPhase", "Current Phase"],
  ] as const) {
    if (!String(c[key] ?? "").trim()) {
      issues.push({
        severity: "warning",
        sheet,
        column: label,
        message: `Recommended field "${label}" is empty — portfolio grouping and governance checks will be limited.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------

const DUPLICATE_SPECS: Array<{ key: TableSpec["key"]; idKey: string; label: string }> = [
  { key: "milestones", idKey: "milestone", label: "Milestone" },
  { key: "deliverables", idKey: "deliverable", label: "Deliverable" },
  { key: "tasks", idKey: "title", label: "Task" },
];

function validateRows(raw: RawWorkbook, issues: ValidationIssue[]) {
  for (const spec of TABLE_SPECS) {
    const table = raw.tables[spec.key];
    if (!table.found) continue;
    const sheet = SHEETS[spec.sheet];
    for (const def of spec.columns) {
      if (!def.mandatory) continue;
      for (const row of table.rows) {
        const v = row.values[def.key];
        if (v == null || String(v).trim() === "") {
          issues.push({
            severity: "error",
            sheet,
            row: row.rowNumber,
            column: def.header,
            message: `"${def.header}" is required but empty.`,
          });
        }
      }
    }
  }

  for (const dup of DUPLICATE_SPECS) {
    const spec = TABLE_SPECS.find((t) => t.key === dup.key)!;
    const seen = new Map<string, number>();
    for (const row of raw.tables[dup.key].rows) {
      const id = String(row.values[dup.idKey] ?? "").trim().toLowerCase();
      if (!id) continue;
      const first = seen.get(id);
      if (first != null) {
        issues.push({
          severity: "error",
          sheet: SHEETS[spec.sheet],
          row: row.rowNumber,
          column: dup.label,
          message: `Duplicate ${dup.label} "${row.values[dup.idKey]}" (first used on row ${first}).`,
        });
      } else {
        seen.set(id, row.rowNumber);
      }
    }
  }

  // Team over-allocation.
  for (const row of raw.tables.team.rows) {
    const alloc = row.values.allocationPct as number | null;
    if (alloc != null && alloc > 100) {
      issues.push({
        severity: "warning",
        sheet: SHEETS.teamBudget,
        row: row.rowNumber,
        column: "Allocation %",
        message: `${String(row.values.name)} is allocated at ${Math.round(alloc)}% (above 100%).`,
      });
    }
  }

  // Negative budget lines.
  for (const row of raw.tables.budget.rows) {
    const planned = row.values.planned as number | null;
    if (planned != null && planned < 0) {
      issues.push({
        severity: "error",
        sheet: SHEETS.teamBudget,
        row: row.rowNumber,
        column: "Planned",
        message: `Planned amount cannot be negative (${planned}).`,
      });
    }
  }
}

// ---------------------------------------------------------------------------

function validateCrossSheet(raw: RawWorkbook, issues: ValidationIssue[]) {
  const charterBudget = raw.charter.budget as number | null;
  const budgetRows = raw.tables.budget.rows;
  if (charterBudget != null && charterBudget > 0 && budgetRows.length > 0) {
    const sheetTotal = budgetRows.reduce(
      (sum, r) => sum + ((r.values.planned as number | null) ?? 0),
      0,
    );
    const gap = Math.abs(sheetTotal - charterBudget) / charterBudget;
    if (gap > 0.1) {
      issues.push({
        severity: "warning",
        sheet: SHEETS.teamBudget,
        message: `Budget breakdown total (${Math.round(sheetTotal).toLocaleString()}) differs from the charter budget (${Math.round(charterBudget).toLocaleString()}) by ${Math.round(gap * 100)}%.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------

function sortIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
    return (a.row ?? 0) - (b.row ?? 0);
  });
}

export type { SheetKey };
