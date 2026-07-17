/**
 * Single source of truth for the standard workbook layout.
 *
 * The parser, the validation engine and the template generator all read from
 * these definitions, so the downloadable template can never drift from what
 * the importer accepts.
 *
 * The workbook has three sheets:
 *   • "Project Brief"  — a document: charter + scope + milestones +
 *                        deliverables + risks + issues
 *   • "Team & Budget"  — team table + budget table
 *   • "Tasks"          — a light task list (feeds the Kanban board)
 *
 * Columns flagged `auto` are CALCULATED (variance, costs, utilization,
 * progress, health). They are rendered as locked/greyed cells in the
 * template and are ignored on import — the app recomputes them.
 */

export const SHEETS = {
  brief: "Project Brief",
  teamBudget: "Team & Budget",
  tasks: "Tasks",
} as const;

export type SheetKey = keyof typeof SHEETS;

export const REQUIRED_SHEETS: SheetKey[] = ["brief"];

export interface ColumnDef {
  /** Exact header text used in the template. */
  header: string;
  /** Property name on the parsed row object. */
  key: string;
  type: "text" | "number" | "percent" | "date";
  /** Missing value ⇒ validation error on the row. */
  mandatory?: boolean;
  /** Calculated column — greyed in the template, ignored on import. */
  auto?: boolean;
}

const col = (
  header: string,
  key: string,
  type: ColumnDef["type"],
  opts: { mandatory?: boolean; auto?: boolean } = {},
): ColumnDef => ({ header, key, type, ...opts });

// ---------------------------------------------------------------------------
// Project Brief — charter (key/value)
// ---------------------------------------------------------------------------

export const CHARTER_FIELDS: ColumnDef[] = [
  col("Project Name", "projectName", "text", { mandatory: true }),
  col("Project Code", "projectCode", "text", { mandatory: true }),
  col("Business Unit", "businessUnit", "text"),
  col("Project Manager", "projectManager", "text", { mandatory: true }),
  col("Sponsor", "sponsor", "text"),
  col("Priority", "priority", "text"),
  col("Status", "status", "text"),
  col("Current Phase", "currentPhase", "text"),
  col("Funding Type", "fundingType", "text"),
  col("Budget", "budget", "number", { mandatory: true }),
  col("Start Date", "plannedStartDate", "date", { mandatory: true }),
  col("Target End Date", "plannedEndDate", "date", { mandatory: true }),
  col("Actual Start Date", "actualStartDate", "date"),
];

/** Charter figures the app calculates — shown greyed, never entered. */
export const CHARTER_AUTO_FIELDS: ColumnDef[] = [
  col("Overall Progress", "overallProgress", "percent", { auto: true }),
  col("Overall Health", "overallHealth", "text", { auto: true }),
  col("Forecast End Date", "forecastEnd", "date", { auto: true }),
];

/** Charter narrative (label above, wrapped free-text below). */
export const NARRATIVE_FIELDS: ColumnDef[] = [
  col("Description", "description", "text"),
  col("Business Need", "businessNeed", "text"),
  col("Objectives", "objectives", "text"),
  col("Benefits", "benefits", "text"),
];

/** Project Brief — scope (key / multi-line value). */
export const SCOPE_FIELDS: ColumnDef[] = [
  col("In Scope", "inScope", "text"),
  col("Out of Scope", "outOfScope", "text"),
  col("Assumptions", "assumptions", "text"),
  col("Constraints", "constraints", "text"),
];

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const MILESTONE_COLUMNS: ColumnDef[] = [
  col("Milestone", "milestone", "text", { mandatory: true }),
  col("Owner", "owner", "text"),
  col("Planned Date", "plannedDate", "date", { mandatory: true }),
  col("Actual Date", "actualDate", "date"),
  col("Status", "status", "text"),
];

export const DELIVERABLE_COLUMNS: ColumnDef[] = [
  col("Deliverable", "deliverable", "text", { mandatory: true }),
  col("Owner", "owner", "text"),
  col("Due Date", "dueDate", "date"),
  col("Completion %", "completionPct", "percent"),
  col("Status", "status", "text"),
  col("Sign-off", "signOff", "text"),
];

export const RISK_COLUMNS: ColumnDef[] = [
  col("Risk", "risk", "text", { mandatory: true }),
  col("Impact", "impact", "text"),
  col("Likelihood", "likelihood", "text"),
  col("Owner", "owner", "text"),
  col("Mitigation", "mitigation", "text"),
  col("Status", "status", "text"),
];

export const ISSUE_COLUMNS: ColumnDef[] = [
  col("Issue", "issue", "text", { mandatory: true }),
  col("Severity", "severity", "text"),
  col("Owner", "owner", "text"),
  col("Target Date", "targetDate", "date"),
  col("Status", "status", "text"),
];

export const TEAM_COLUMNS: ColumnDef[] = [
  col("Name", "name", "text", { mandatory: true }),
  col("Role", "role", "text"),
  col("Allocation %", "allocationPct", "percent"),
  col("Planned Hours", "plannedHours", "number"),
  col("Actual Hours", "actualHours", "number"),
  col("Hourly Rate", "hourlyRate", "number"),
  col("Planned Cost", "plannedCost", "number", { auto: true }),
  col("Actual Cost", "actualCost", "number", { auto: true }),
  col("Utilization %", "utilization", "percent", { auto: true }),
];

export const BUDGET_COLUMNS: ColumnDef[] = [
  col("Category", "category", "text", { mandatory: true }),
  col("Planned", "planned", "number"),
  col("Actual", "actual", "number"),
  col("Forecast", "forecast", "number"),
  col("Variance", "variance", "number", { auto: true }),
];

export const TASK_COLUMNS: ColumnDef[] = [
  col("Task", "title", "text", { mandatory: true }),
  col("Owner", "owner", "text"),
  col("Priority", "priority", "text"),
  col("Due Date", "dueDate", "date"),
  col("Status", "status", "text"),
];

/**
 * Tables and the sheet they live on, keyed by the first (identifying) header
 * — the parser locates each table by scanning column A for this header.
 */
export interface TableSpec {
  key:
    | "milestones"
    | "deliverables"
    | "risks"
    | "issues"
    | "team"
    | "budget"
    | "tasks";
  sheet: SheetKey;
  columns: ColumnDef[];
}

export const TABLE_SPECS: TableSpec[] = [
  { key: "milestones", sheet: "brief", columns: MILESTONE_COLUMNS },
  { key: "deliverables", sheet: "brief", columns: DELIVERABLE_COLUMNS },
  { key: "risks", sheet: "brief", columns: RISK_COLUMNS },
  { key: "issues", sheet: "brief", columns: ISSUE_COLUMNS },
  { key: "team", sheet: "teamBudget", columns: TEAM_COLUMNS },
  { key: "budget", sheet: "teamBudget", columns: BUDGET_COLUMNS },
  { key: "tasks", sheet: "tasks", columns: TASK_COLUMNS },
];

/** First-column header text used to locate every table on a shared sheet. */
export const TABLE_MARKERS = TABLE_SPECS.map((t) => t.columns[0].header);

/** Header comparison: case-insensitive, whitespace- and asterisk-tolerant. */
export function normalizeHeader(header: unknown): string {
  return String(header ?? "")
    .trim()
    .replace(/\s*\*$/, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}
