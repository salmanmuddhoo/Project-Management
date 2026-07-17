/**
 * Single source of truth for the standard workbook layout.
 *
 * The parser (`parseWorkbook.ts`), the validation engine
 * (`validateWorkbook.ts`) and the template generator (`template.ts`) all read
 * from these definitions, so the downloadable template can never drift from
 * what the importer accepts.
 */

export const SHEETS = {
  charter: "Project Charter",
  outputs: "Expected Outputs",
  scope: "Scope",
  milestones: "Milestones",
  resources: "Resource Planning",
  budget: "Budget",
  risks: "Risks",
  issues: "Issues",
  backlog: "Product Backlog",
  timeTracking: "Time Tracking",
  sprints: "Sprints",
} as const;

export type SheetKey = keyof typeof SHEETS;

/** Sprints is the only optional worksheet. */
export const REQUIRED_SHEETS: SheetKey[] = [
  "charter",
  "outputs",
  "scope",
  "milestones",
  "resources",
  "budget",
  "risks",
  "issues",
  "backlog",
  "timeTracking",
];

export interface ColumnDef {
  /** Exact header text used in the template. */
  header: string;
  /** Property name on the parsed row object. */
  key: string;
  /** Missing value ⇒ validation error on the row. */
  mandatory?: boolean;
  type: "text" | "number" | "percent" | "date";
}

const col = (
  header: string,
  key: string,
  type: ColumnDef["type"],
  mandatory = false,
): ColumnDef => ({ header, key, type, mandatory });

/** Charter is a key/value sheet: Field | Value. Order = template order. */
export const CHARTER_FIELDS: ColumnDef[] = [
  col("Project Name", "projectName", "text", true),
  col("Project Code", "projectCode", "text", true),
  col("Business Unit", "businessUnit", "text"),
  col("Project Manager", "projectManager", "text", true),
  col("Sponsor", "sponsor", "text", true),
  col("Priority", "priority", "text"),
  col("Status", "status", "text"),
  col("Current Phase", "currentPhase", "text"),
  col("Description", "description", "text"),
  col("Business Need", "businessNeed", "text"),
  col("Objectives", "objectives", "text"),
  col("Benefits", "benefits", "text"),
  col("Funding Type", "fundingType", "text"),
  col("Budget", "budget", "number", true),
  col("Funding Amount", "fundingAmount", "number"),
  col("Planned Start Date", "plannedStartDate", "date", true),
  col("Planned End Date", "plannedEndDate", "date", true),
  col("Actual Start Date", "actualStartDate", "date"),
  col("Forecast End Date", "forecastEndDate", "date"),
  col("Current Progress %", "currentProgressPct", "percent"),
  col("Overall Health", "overallHealth", "text"),
];

export const OUTPUT_COLUMNS: ColumnDef[] = [
  col("Output ID", "outputId", "text", true),
  col("Deliverable", "deliverable", "text", true),
  col("Description", "description", "text"),
  col("Owner", "owner", "text"),
  col("Acceptance Criteria", "acceptanceCriteria", "text"),
  col("Planned Delivery Date", "plannedDeliveryDate", "date"),
  col("Actual Delivery Date", "actualDeliveryDate", "date"),
  col("Completion %", "completionPct", "percent"),
  col("Status", "status", "text"),
  col("Customer Approval", "customerApproval", "text"),
];

/** Scope is a key/value sheet; each key holds one item per line. */
export const SCOPE_FIELDS: ColumnDef[] = [
  col("Deliverables", "deliverables", "text"),
  col("Out of Scope", "outOfScope", "text"),
  col("Success Criteria", "successCriteria", "text"),
  col("Dependencies", "dependencies", "text"),
  col("Constraints", "constraints", "text"),
  col("Assumptions", "assumptions", "text"),
];

export const MILESTONE_COLUMNS: ColumnDef[] = [
  col("Milestone", "milestone", "text", true),
  col("Description", "description", "text"),
  col("Planned Date", "plannedDate", "date", true),
  col("Actual Date", "actualDate", "date"),
  col("Owner", "owner", "text"),
  col("Progress %", "progressPct", "percent"),
  col("Status", "status", "text"),
];

export const RESOURCE_COLUMNS: ColumnDef[] = [
  col("Employee", "employee", "text", true),
  col("Role", "role", "text"),
  col("Department", "department", "text"),
  col("Allocation %", "allocationPct", "percent"),
  col("Available Hours", "availableHours", "number"),
  col("Planned Hours", "plannedHours", "number"),
  col("Actual Hours", "actualHours", "number"),
  col("Remaining Hours", "remainingHours", "number"),
  col("Hourly Rate", "hourlyRate", "number"),
  col("Planned Cost", "plannedCost", "number"),
  col("Actual Cost", "actualCost", "number"),
];

export const BUDGET_COLUMNS: ColumnDef[] = [
  col("Category", "category", "text", true),
  col("Planned", "planned", "number"),
  col("Actual", "actual", "number"),
  col("Forecast", "forecast", "number"),
  col("Variance", "variance", "number"),
];

export const RISK_COLUMNS: ColumnDef[] = [
  col("Risk ID", "riskId", "text", true),
  col("Description", "description", "text", true),
  col("Probability", "probability", "text"),
  col("Impact", "impact", "text"),
  col("Mitigation", "mitigation", "text"),
  col("Owner", "owner", "text"),
  col("Status", "status", "text"),
];

export const ISSUE_COLUMNS: ColumnDef[] = [
  col("Issue ID", "issueId", "text", true),
  col("Description", "description", "text", true),
  col("Severity", "severity", "text"),
  col("Owner", "owner", "text"),
  col("Raised Date", "raisedDate", "date"),
  col("Target Date", "targetDate", "date"),
  col("Status", "status", "text"),
];

export const BACKLOG_COLUMNS: ColumnDef[] = [
  col("Task ID", "taskId", "text", true),
  col("Epic", "epic", "text"),
  col("Feature", "feature", "text"),
  col("User Story", "userStory", "text"),
  col("Task Title", "taskTitle", "text", true),
  col("Description", "description", "text"),
  col("Priority", "priority", "text"),
  col("Story Points", "storyPoints", "number"),
  col("Estimated Hours", "estimatedHours", "number"),
  col("Remaining Hours", "remainingHours", "number"),
  col("Actual Hours", "actualHours", "number"),
  col("Sprint", "sprint", "text"),
  col("Assignee", "assignee", "text"),
  col("Status", "status", "text"),
  col("Dependencies", "dependencies", "text"),
  col("Created Date", "createdDate", "date"),
  col("Start Date", "startDate", "date"),
  col("Due Date", "dueDate", "date"),
  col("Completed Date", "completedDate", "date"),
  col("Tags", "tags", "text"),
  col("Comments", "comments", "text"),
];

export const TIME_COLUMNS: ColumnDef[] = [
  col("Employee", "employee", "text", true),
  col("Date", "date", "date", true),
  col("Task ID", "taskId", "text"),
  col("Hours", "hours", "number", true),
  col("Activity", "activity", "text"),
  col("Project Phase", "projectPhase", "text"),
];

export const SPRINT_COLUMNS: ColumnDef[] = [
  col("Sprint Number", "sprintNumber", "text", true),
  col("Sprint Goal", "sprintGoal", "text"),
  col("Start Date", "startDate", "date"),
  col("End Date", "endDate", "date"),
  col("Capacity", "capacity", "number"),
  col("Committed Hours", "committedHours", "number"),
  col("Completed Hours", "completedHours", "number"),
  col("Velocity", "velocity", "number"),
  col("Completion %", "completionPct", "percent"),
];

/** Column definitions per tabular sheet (charter/scope are key/value). */
export const TABULAR_SHEETS: Partial<Record<SheetKey, ColumnDef[]>> = {
  outputs: OUTPUT_COLUMNS,
  milestones: MILESTONE_COLUMNS,
  resources: RESOURCE_COLUMNS,
  budget: BUDGET_COLUMNS,
  risks: RISK_COLUMNS,
  issues: ISSUE_COLUMNS,
  backlog: BACKLOG_COLUMNS,
  timeTracking: TIME_COLUMNS,
  sprints: SPRINT_COLUMNS,
};

/**
 * Header comparison: case-insensitive, whitespace-tolerant, and blind to the
 * trailing "*" the template uses to mark mandatory columns.
 */
export function normalizeHeader(header: unknown): string {
  return String(header ?? "")
    .trim()
    .replace(/\s*\*$/, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}
