/**
 * Domain model for the standardized project workbook.
 *
 * The workbook is deliberately small — three sheets (Project Brief, Team &
 * Budget, Tasks) with minimal columns (see docs/EXCEL_TEMPLATE.md). Manager
 * input is the ONLY thing modelled here; every derived figure (health,
 * progress, variance, utilization…) is computed by pure functions in
 * `src/lib/metrics` and is intentionally NOT part of this model.
 */

export type Priority = "Critical" | "High" | "Medium" | "Low" | "";

export type ProjectStatus =
  | "Not Started"
  | "On Track"
  | "At Risk"
  | "Delayed"
  | "On Hold"
  | "Completed"
  | "Cancelled"
  | "";

export type LifecyclePhase =
  | "Initiation"
  | "Planning"
  | "Execution"
  | "Monitoring & Control"
  | "Closure"
  | "";

export const LIFECYCLE_PHASES: LifecyclePhase[] = [
  "Initiation",
  "Planning",
  "Execution",
  "Monitoring & Control",
  "Closure",
];

export type RagStatus = "Green" | "Amber" | "Red";

export type FundingType = "CAPEX" | "OPEX" | "Mixed" | "";

/** Project Brief › Charter block (manager-entered facts only). */
export interface ProjectCharter {
  projectName: string;
  projectCode: string;
  businessUnit: string;
  projectManager: string;
  sponsor: string;
  priority: Priority;
  status: ProjectStatus;
  currentPhase: LifecyclePhase;
  fundingType: FundingType;
  budget: number | null;
  plannedStartDate: Date | null;
  /** "Target End Date" in the sheet. */
  plannedEndDate: Date | null;
  actualStartDate: Date | null;
  description: string;
  businessNeed: string;
  objectives: string;
  benefits: string;
}

/** Project Brief › Scope block (one item per line). */
export interface ScopeDefinition {
  inScope: string[];
  outOfScope: string[];
  assumptions: string[];
  constraints: string[];
}

/** Project Brief › Milestones table. */
export interface Milestone {
  milestone: string;
  owner: string;
  plannedDate: Date | null;
  actualDate: Date | null;
  status: string;
}

/** Project Brief › Deliverables table. */
export interface Deliverable {
  deliverable: string;
  owner: string;
  dueDate: Date | null;
  completionPct: number | null;
  status: string;
  /** Customer/business sign-off (Yes/No/Pending). */
  signOff: string;
}

/** Project Brief › Risks table. */
export interface Risk {
  risk: string;
  impact: string;
  likelihood: string;
  owner: string;
  mitigation: string;
  status: string;
}

/** Project Brief › Issues table. */
export interface Issue {
  issue: string;
  severity: string;
  owner: string;
  targetDate: Date | null;
  status: string;
}

/** Team & Budget › Team table (costs are auto-derived, not entered). */
export interface TeamMember {
  name: string;
  role: string;
  allocationPct: number | null;
  plannedHours: number | null;
  actualHours: number | null;
  hourlyRate: number | null;
}

/** Team & Budget › Budget table (variance is auto-derived). */
export interface BudgetLine {
  category: string;
  planned: number | null;
  actual: number | null;
  forecast: number | null;
}

/** Kanban columns, in board order. A task's Status maps onto these. */
export const KANBAN_COLUMNS = [
  "Backlog",
  "Ready",
  "To Do",
  "In Progress",
  "Blocked",
  "Review",
  "Done",
] as const;

export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

/** Tasks sheet — a light task list (no sprints, points or hours). */
export interface Task {
  /** Stable id within the workbook, derived on import (e.g. "T3"). */
  id: string;
  title: string;
  owner: string;
  priority: Priority;
  dueDate: Date | null;
  status: KanbanColumn;
}

/** A fully parsed, validated project workbook held in memory. */
export interface Project {
  id: string;
  charter: ProjectCharter;
  scope: ScopeDefinition;
  milestones: Milestone[];
  deliverables: Deliverable[];
  risks: Risk[];
  issues: Issue[];
  team: TeamMember[];
  budget: BudgetLine[];
  tasks: Task[];
  meta: {
    sourceFileName: string;
    importedAt: Date;
    warningCount: number;
  };
}
