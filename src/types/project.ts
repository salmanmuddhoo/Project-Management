/**
 * Domain model.
 *
 * The app consumes two real exports (see docs/IMPORT_FORMATS.md):
 *  1. A **Microsoft Planner** board export (.xlsx) — one plan = one project.
 *     Buckets ("Catégories") are the swimlanes; the "Project Details" bucket
 *     holds three special cards (Project Charter, Taches Timorc, Resources);
 *     every other bucket holds work tasks.
 *  2. A **Timorc** time-tracking export (.csv/.xlsx) — daily time per person
 *     per task code, matched to a project by its Timorc code(s).
 *
 * Manager-provided data only lives here; consumed hours, progress, health and
 * risk are computed by pure functions in `src/lib/metrics`.
 */

export type Priority = "Critical" | "High" | "Medium" | "Low" | "";

export type RagStatus = "Green" | "Amber" | "Red";

/** Project Details › Project Charter card. */
export interface ProjectCharter {
  projectName: string;
  /** Timorc project prefix (e.g. "MAURITIUS9") or a derived code. */
  projectCode: string;
  planId: string;
  startDate: Date | null;
  endDate: Date | null;
  /** Hours budget parsed from the charter label (e.g. "50 hrs"). */
  budgetHours: number | null;
  manager: string;
  /** Full charter notes (what/why/success criteria…). */
  notes: string;
}

/** Project Details › Resources card (one role/name pair per two lines). */
export interface Resource {
  role: string;
  name: string;
}

/** Project Details › Taches Timorc card (one code per line). */
export interface TimorcCode {
  /** e.g. "MAURITIUS9 - 100.003". */
  code: string;
  /** Project prefix segment before " - " (e.g. "MAURITIUS9"). */
  projectPrefix: string;
}

/** A work task, living in a bucket (swimlane) other than Project Details. */
export interface Task {
  id: string;
  title: string;
  /** Bucket / swimlane name — the Kanban column. */
  bucket: string;
  /** Planner progress field ("Non démarrées" / "En cours" / "Terminées"). */
  progressStatus: string;
  priority: Priority;
  assignee: string;
  startDate: Date | null;
  dueDate: Date | null;
  endDate: Date | null;
  overdue: boolean;
  labels: string;
  notes: string;
}

/** A fully parsed Planner board = one project. */
export interface Project {
  id: string;
  charter: ProjectCharter;
  resources: Resource[];
  timorcCodes: TimorcCode[];
  /** Ordered bucket names (swimlanes), excluding "Project Details". */
  buckets: string[];
  tasks: Task[];
  meta: {
    sourceFileName: string;
    importedAt: Date;
    warningCount: number;
  };
}
