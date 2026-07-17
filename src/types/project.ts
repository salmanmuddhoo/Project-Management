/**
 * Domain model for the standardized project workbook.
 *
 * These interfaces mirror the Excel template one-to-one (see
 * docs/EXCEL_TEMPLATE.md). Raw workbook data is parsed into a `Project`;
 * every derived figure (health, variance, utilization…) is computed by pure
 * functions in `src/lib/metrics` and is intentionally NOT part of this model.
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

/** Sheet 1 — Project Charter (key/value sheet). */
export interface ProjectCharter {
  projectName: string;
  projectCode: string;
  businessUnit: string;
  projectManager: string;
  sponsor: string;
  priority: Priority;
  status: ProjectStatus;
  currentPhase: LifecyclePhase;
  description: string;
  businessNeed: string;
  objectives: string;
  benefits: string;
  fundingType: FundingType;
  budget: number | null;
  fundingAmount: number | null;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  actualStartDate: Date | null;
  forecastEndDate: Date | null;
  /** Manager-reported progress, normalized to 0–100. */
  currentProgressPct: number | null;
  /** Manager-reported health; the computed score may disagree. */
  overallHealth: RagStatus | "";
}

/** Sheet 2 — Expected Outputs. */
export interface ExpectedOutput {
  outputId: string;
  deliverable: string;
  description: string;
  owner: string;
  acceptanceCriteria: string;
  plannedDeliveryDate: Date | null;
  actualDeliveryDate: Date | null;
  completionPct: number | null;
  status: string;
  customerApproval: string;
}

/** Sheet 3 — Scope (key/multi-line value sheet). */
export interface ScopeDefinition {
  deliverables: string[];
  outOfScope: string[];
  successCriteria: string[];
  dependencies: string[];
  constraints: string[];
  assumptions: string[];
}

/** Sheet 4 — Milestones. */
export interface Milestone {
  milestone: string;
  description: string;
  plannedDate: Date | null;
  actualDate: Date | null;
  owner: string;
  progressPct: number | null;
  status: string;
}

/** Sheet 5 — Resource Planning. */
export interface ResourcePlan {
  employee: string;
  role: string;
  department: string;
  allocationPct: number | null;
  availableHours: number | null;
  plannedHours: number | null;
  actualHours: number | null;
  remainingHours: number | null;
  hourlyRate: number | null;
  plannedCost: number | null;
  actualCost: number | null;
}

/** Sheet 6 — Budget. */
export interface BudgetLine {
  category: string;
  planned: number | null;
  actual: number | null;
  forecast: number | null;
  variance: number | null;
}

/** Sheet 7 — Risks. */
export interface Risk {
  riskId: string;
  description: string;
  probability: string;
  impact: string;
  mitigation: string;
  owner: string;
  status: string;
}

/** Sheet 8 — Issues. */
export interface Issue {
  issueId: string;
  description: string;
  severity: string;
  owner: string;
  raisedDate: Date | null;
  targetDate: Date | null;
  status: string;
}

/** Kanban columns, in board order. Backlog `Status` maps onto these. */
export const KANBAN_COLUMNS = [
  "Backlog",
  "Ready",
  "To Do",
  "In Progress",
  "Blocked",
  "Testing",
  "Review",
  "Done",
] as const;

export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

/** Sheet 9 — Product Backlog. */
export interface BacklogItem {
  taskId: string;
  epic: string;
  feature: string;
  userStory: string;
  taskTitle: string;
  description: string;
  priority: Priority;
  storyPoints: number | null;
  estimatedHours: number | null;
  remainingHours: number | null;
  actualHours: number | null;
  sprint: string;
  assignee: string;
  status: KanbanColumn;
  dependencies: string;
  createdDate: Date | null;
  startDate: Date | null;
  dueDate: Date | null;
  completedDate: Date | null;
  tags: string;
  comments: string;
}

/** Sheet 10 — Time Tracking. */
export interface TimeEntry {
  employee: string;
  date: Date | null;
  taskId: string;
  hours: number | null;
  activity: string;
  projectPhase: string;
}

/** Sheet 11 — Sprints (optional). */
export interface Sprint {
  sprintNumber: string;
  sprintGoal: string;
  startDate: Date | null;
  endDate: Date | null;
  capacity: number | null;
  committedHours: number | null;
  completedHours: number | null;
  velocity: number | null;
  completionPct: number | null;
}

/** A fully parsed, validated project workbook held in memory. */
export interface Project {
  /** Stable id for the session (derived from code + file name). */
  id: string;
  charter: ProjectCharter;
  outputs: ExpectedOutput[];
  scope: ScopeDefinition;
  milestones: Milestone[];
  resources: ResourcePlan[];
  budget: BudgetLine[];
  risks: Risk[];
  issues: Issue[];
  backlog: BacklogItem[];
  timeTracking: TimeEntry[];
  sprints: Sprint[];
  meta: {
    sourceFileName: string;
    importedAt: Date;
    warningCount: number;
  };
}
