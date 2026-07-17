/**
 * Validation engine — runs on the RawWorkbook BEFORE anything enters the
 * portfolio. Errors block import; warnings are shown but importable.
 *
 * Rule groups (see docs/EXCEL_TEMPLATE.md):
 *   1. Structure   — required sheets & columns exist
 *   2. Charter     — mandatory fields, date sanity, non-negative budget
 *   3. Row-level   — mandatory cells, duplicate IDs, bad values
 *   4. Cross-sheet — budget consistency, time-log & sprint references
 */

import type { RawWorkbook } from "@/lib/excel/parseWorkbook";
import {
  REQUIRED_SHEETS,
  SHEETS,
  TABULAR_SHEETS,
  type SheetKey,
} from "@/lib/excel/schema";
import type {
  ValidationIssue,
  ValidationReport,
} from "@/types/validation";

export function validateWorkbook(raw: RawWorkbook): ValidationReport {
  const issues: ValidationIssue[] = [...raw.coercionIssues];
  const present = new Set(raw.presentSheets);

  // -- 1. Structure ---------------------------------------------------------
  for (const key of REQUIRED_SHEETS) {
    if (!present.has(key)) {
      issues.push({
        severity: "error",
        sheet: "Workbook",
        message: `Required worksheet "${SHEETS[key]}" is missing.`,
      });
    }
  }
  for (const [key, table] of Object.entries(raw.tables)) {
    for (const header of table.missingColumns) {
      issues.push({
        severity: "error",
        sheet: SHEETS[key as SheetKey],
        message: `Required column "${header}" is missing.`,
      });
    }
  }

  if (present.has("charter")) validateCharter(raw, issues);
  validateRows(raw, issues);
  validateCrossSheet(raw, issues);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.length - errorCount;
  return {
    fileName: raw.fileName,
    issues: sortIssues(issues),
    errorCount,
    warningCount,
    valid: errorCount === 0,
  };
}

// ---------------------------------------------------------------------------

function validateCharter(raw: RawWorkbook, issues: ValidationIssue[]) {
  const sheet = SHEETS.charter;
  const c = raw.charter;

  const mandatoryText: Array<[string, string]> = [
    ["projectName", "Project Name"],
    ["projectCode", "Project Code"],
    ["projectManager", "Project Manager"],
  ];
  for (const [key, label] of mandatoryText) {
    if (!String(c[key] ?? "").trim()) {
      issues.push({
        severity: "error",
        sheet,
        column: label,
        message: `Mandatory field "${label}" is empty.`,
      });
    }
  }

  // Missing sponsor is flagged but does not block import — governance checks
  // and executive recommendations surface sponsor-less projects to the board.
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
    issues.push({
      severity: "error",
      sheet,
      column: "Budget",
      message: "Mandatory field \"Budget\" is empty.",
    });
  } else if (budget < 0) {
    issues.push({
      severity: "error",
      sheet,
      column: "Budget",
      message: `Budget cannot be negative (${budget}).`,
    });
  }

  const start = c.plannedStartDate as Date | null;
  const end = c.plannedEndDate as Date | null;
  if (!start) {
    issues.push({
      severity: "error",
      sheet,
      column: "Planned Start Date",
      message: "Planned Start Date is missing.",
    });
  }
  if (!end) {
    issues.push({
      severity: "error",
      sheet,
      column: "Planned End Date",
      message: "Planned End Date is missing.",
    });
  }
  if (start && end && start.getTime() > end.getTime()) {
    issues.push({
      severity: "error",
      sheet,
      message: "Planned Start Date is after Planned End Date.",
    });
  }

  const recommended: Array<[string, string]> = [
    ["businessUnit", "Business Unit"],
    ["priority", "Priority"],
    ["status", "Status"],
    ["currentPhase", "Current Phase"],
    ["fundingType", "Funding Type"],
    ["currentProgressPct", "Current Progress %"],
  ];
  for (const [key, label] of recommended) {
    const v = c[key];
    if (v == null || String(v).trim() === "") {
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

interface DuplicateSpec {
  sheet: SheetKey;
  idKey: string;
  idLabel: string;
}

const DUPLICATE_SPECS: DuplicateSpec[] = [
  { sheet: "outputs", idKey: "outputId", idLabel: "Output ID" },
  { sheet: "milestones", idKey: "milestone", idLabel: "Milestone" },
  { sheet: "risks", idKey: "riskId", idLabel: "Risk ID" },
  { sheet: "issues", idKey: "issueId", idLabel: "Issue ID" },
  { sheet: "backlog", idKey: "taskId", idLabel: "Task ID" },
];

function validateRows(raw: RawWorkbook, issues: ValidationIssue[]) {
  // Mandatory cells on every tabular sheet.
  for (const [key, columns] of Object.entries(TABULAR_SHEETS)) {
    const table = raw.tables[key as SheetKey];
    if (!table) continue;
    const sheet = SHEETS[key as SheetKey];
    const mandatory = columns.filter((c) => c.mandatory);
    for (const row of table.rows) {
      for (const def of mandatory) {
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

  // Duplicate IDs.
  for (const spec of DUPLICATE_SPECS) {
    const table = raw.tables[spec.sheet];
    if (!table) continue;
    const seen = new Map<string, number>();
    for (const row of table.rows) {
      const id = String(row.values[spec.idKey] ?? "").trim().toLowerCase();
      if (!id) continue;
      const first = seen.get(id);
      if (first != null) {
        issues.push({
          severity: "error",
          sheet: SHEETS[spec.sheet],
          row: row.rowNumber,
          column: spec.idLabel,
          message: `Duplicate ${spec.idLabel} "${row.values[spec.idKey]}" (first used on row ${first}).`,
        });
      } else {
        seen.set(id, row.rowNumber);
      }
    }
  }

  // Resource sanity.
  const resources = raw.tables.resources;
  if (resources) {
    for (const row of resources.rows) {
      const alloc = row.values.allocationPct as number | null;
      if (alloc != null && alloc > 100) {
        issues.push({
          severity: "warning",
          sheet: SHEETS.resources,
          row: row.rowNumber,
          column: "Allocation %",
          message: `${String(row.values.employee)} is allocated at ${Math.round(alloc)}% (above 100%).`,
        });
      }
      const available = row.values.availableHours as number | null;
      const planned = row.values.plannedHours as number | null;
      if (available != null && planned != null && planned > available) {
        issues.push({
          severity: "warning",
          sheet: SHEETS.resources,
          row: row.rowNumber,
          message: `${String(row.values.employee)}: planned hours (${planned}) exceed available hours (${available}).`,
        });
      }
    }
  }

  // Negative budget lines.
  const budget = raw.tables.budget;
  if (budget) {
    for (const row of budget.rows) {
      const planned = row.values.planned as number | null;
      if (planned != null && planned < 0) {
        issues.push({
          severity: "error",
          sheet: SHEETS.budget,
          row: row.rowNumber,
          column: "Planned",
          message: `Planned amount cannot be negative (${planned}).`,
        });
      }
    }
  }

  // Deliverables must exist somewhere: outputs sheet or scope deliverables.
  const outputRows = raw.tables.outputs?.rows ?? [];
  const scopeDeliverables = raw.scope.deliverables ?? [];
  if (
    raw.presentSheets.includes("outputs") &&
    outputRows.length === 0 &&
    scopeDeliverables.length === 0
  ) {
    issues.push({
      severity: "error",
      sheet: SHEETS.outputs,
      message:
        "No deliverables defined — add at least one Expected Output (or Scope deliverable).",
    });
  }
}

// ---------------------------------------------------------------------------

function validateCrossSheet(raw: RawWorkbook, issues: ValidationIssue[]) {
  // Budget sheet total vs charter budget (>10% gap → warning).
  const charterBudget = raw.charter.budget as number | null;
  const budgetRows = raw.tables.budget?.rows ?? [];
  if (charterBudget != null && charterBudget > 0 && budgetRows.length > 0) {
    const sheetTotal = budgetRows.reduce(
      (sum, r) => sum + ((r.values.planned as number | null) ?? 0),
      0,
    );
    const gap = Math.abs(sheetTotal - charterBudget) / charterBudget;
    if (gap > 0.1) {
      issues.push({
        severity: "warning",
        sheet: SHEETS.budget,
        message: `Budget sheet total (${Math.round(sheetTotal).toLocaleString()}) differs from the charter budget (${Math.round(charterBudget).toLocaleString()}) by ${Math.round(gap * 100)}%.`,
      });
    }
  }

  // Time-log task IDs unknown to the backlog.
  const backlogIds = new Set(
    (raw.tables.backlog?.rows ?? []).map((r) =>
      String(r.values.taskId ?? "").trim().toLowerCase(),
    ),
  );
  for (const row of raw.tables.timeTracking?.rows ?? []) {
    const taskId = String(row.values.taskId ?? "").trim();
    if (taskId && !backlogIds.has(taskId.toLowerCase())) {
      issues.push({
        severity: "warning",
        sheet: SHEETS.timeTracking,
        row: row.rowNumber,
        column: "Task ID",
        message: `Task ID "${taskId}" does not exist in the Product Backlog.`,
      });
    }
  }

  // Backlog sprint references unknown to the Sprints sheet (when present).
  const sprintRows = raw.tables.sprints?.rows ?? [];
  if (sprintRows.length > 0) {
    const sprintIds = new Set(
      sprintRows.map((r) =>
        String(r.values.sprintNumber ?? "").trim().toLowerCase(),
      ),
    );
    const flagged = new Set<string>();
    for (const row of raw.tables.backlog?.rows ?? []) {
      const sprint = String(row.values.sprint ?? "").trim();
      if (sprint && !sprintIds.has(sprint.toLowerCase()) && !flagged.has(sprint)) {
        flagged.add(sprint);
        issues.push({
          severity: "warning",
          sheet: SHEETS.backlog,
          row: row.rowNumber,
          column: "Sprint",
          message: `Sprint "${sprint}" is not defined on the Sprints sheet.`,
        });
      }
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
