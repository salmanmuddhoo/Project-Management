/**
 * Per-project calculation engine. Pure functions over a parsed Planner
 * project and its matched Timorc time entries. Nothing is stored; every view
 * derives from the same computations.
 */

import type { Project, Task } from "@/types/project";
import type { TimeEntry } from "@/types/time";
import { HOURS_PER_DAY } from "@/lib/config";
import { clamp, daysBetween, ratio } from "@/lib/utils";

export interface ResourceTime {
  name: string;
  days: number;
  hours: number;
}
export interface CodeTime {
  code: string;
  task: string;
  days: number;
  hours: number;
}

export interface ProjectMetrics {
  // Schedule
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number | null;
  daysRemaining: number | null;
  timeElapsedPct: number | null;
  overdue: boolean;

  // Budget (time)
  budgetHours: number | null;
  consumedDays: number;
  consumedHours: number;
  budgetConsumedPct: number | null;
  remainingHours: number | null;
  overBudget: boolean;

  // Tasks
  tasksTotal: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksBlocked: number;
  tasksOverdue: number;
  taskCompletionPct: number | null;
  byBucket: Array<{ bucket: string; count: number }>;

  // Effort estimates (from task labels)
  estimateHoursTotal: number;
  estimateHoursDone: number;
  /** Estimate-weighted completion; null when no estimates are present. */
  effortCompletionPct: number | null;

  // People / codes
  byResource: ResourceTime[];
  byCode: CodeTime[];
  timeEntryCount: number;

  /** Progress (0–100): effort-weighted when estimates exist, else task count. */
  overallProgressPct: number;
}

const DONE_BUCKETS = ["completed", "done", "terminé", "terminée", "terminées", "termine", "closed", "clos"];
const BLOCKED_BUCKETS = ["blocked", "bloqué", "bloque", "on hold"];
const PROGRESS_BUCKETS = ["in progress", "en cours", "doing", "wip"];

const norm = (s: string) => s.trim().toLowerCase();
const isDoneBucket = (b: string) => DONE_BUCKETS.includes(norm(b));
const isBlockedBucket = (b: string) => BLOCKED_BUCKETS.includes(norm(b));
const isProgressBucket = (b: string) => PROGRESS_BUCKETS.includes(norm(b));

function isTaskDone(t: Task): boolean {
  return isDoneBucket(t.bucket) || t.endDate != null || norm(t.progressStatus).startsWith("termin");
}

export function computeProjectMetrics(
  project: Project,
  entries: TimeEntry[],
  today: Date = new Date(),
  hoursPerDay: number = HOURS_PER_DAY,
): ProjectMetrics {
  const { charter } = project;

  // -- Schedule -------------------------------------------------------------
  const start = charter.startDate;
  const end = charter.endDate;
  const durationDays = start && end ? daysBetween(start, end) : null;
  const timeElapsedPct =
    start && end
      ? clamp(ratio(daysBetween(start, today), Math.max(1, daysBetween(start, end))) * 100, 0, 100)
      : null;
  const daysRemaining = end ? daysBetween(today, end) : null;

  // -- Tasks ----------------------------------------------------------------
  const tasksTotal = project.tasks.length;
  const tasksCompleted = project.tasks.filter(isTaskDone).length;
  const tasksBlocked = project.tasks.filter((t) => isBlockedBucket(t.bucket)).length;
  const tasksInProgress = project.tasks.filter((t) => isProgressBucket(t.bucket)).length;
  const tasksOverdue = project.tasks.filter(
    (t) => !isTaskDone(t) && (t.overdue || (t.dueDate != null && t.dueDate < today)),
  ).length;
  const taskCompletionPct = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : null;

  // Effort-weighted completion, when tasks carry estimates.
  const estimateHoursTotal = project.tasks.reduce((s, t) => s + (t.estimateHours ?? 0), 0);
  const estimateHoursDone = project.tasks
    .filter(isTaskDone)
    .reduce((s, t) => s + (t.estimateHours ?? 0), 0);
  const effortCompletionPct =
    estimateHoursTotal > 0 ? (estimateHoursDone / estimateHoursTotal) * 100 : null;

  const bucketCounts = new Map<string, number>();
  for (const b of project.buckets) bucketCounts.set(b, 0);
  for (const t of project.tasks) bucketCounts.set(t.bucket, (bucketCounts.get(t.bucket) ?? 0) + 1);
  const byBucket = [...bucketCounts.entries()].map(([bucket, count]) => ({ bucket, count }));

  // -- Time (budget) --------------------------------------------------------
  const consumedDays = entries.reduce((s, e) => s + (e.days ?? 0), 0);
  const consumedHours = consumedDays * hoursPerDay;
  const budgetHours = charter.budgetHours;
  const budgetConsumedPct =
    budgetHours && budgetHours > 0 ? (consumedHours / budgetHours) * 100 : null;
  const remainingHours = budgetHours != null ? budgetHours - consumedHours : null;
  const overBudget = budgetHours != null && consumedHours > budgetHours;

  // Per person / per code rollups
  const byResource = rollup(entries, (e) => e.person, hoursPerDay).map(([name, days]) => ({
    name,
    days,
    hours: days * hoursPerDay,
  }));
  const codeMap = new Map<string, { task: string; days: number }>();
  for (const e of entries) {
    const key = e.code || e.projet;
    const cur = codeMap.get(key) ?? { task: e.task, days: 0 };
    cur.days += e.days ?? 0;
    if (!cur.task) cur.task = e.task;
    codeMap.set(key, cur);
  }
  const byCode: CodeTime[] = [...codeMap.entries()]
    .map(([code, v]) => ({ code, task: v.task, days: v.days, hours: v.days * hoursPerDay }))
    .sort((a, b) => b.hours - a.hours);

  return {
    startDate: start,
    endDate: end,
    durationDays,
    daysRemaining,
    timeElapsedPct,
    overdue: end != null && end < today && (taskCompletionPct ?? 0) < 100,

    budgetHours,
    consumedDays,
    consumedHours,
    budgetConsumedPct,
    remainingHours,
    overBudget,

    tasksTotal,
    tasksCompleted,
    tasksInProgress,
    tasksBlocked,
    tasksOverdue,
    taskCompletionPct,
    byBucket,

    estimateHoursTotal,
    estimateHoursDone,
    effortCompletionPct,

    byResource: byResource.sort((a, b) => b.hours - a.hours),
    byCode,
    timeEntryCount: entries.length,

    overallProgressPct: clamp(effortCompletionPct ?? taskCompletionPct ?? 0, 0, 100),
  };
}

function rollup(
  entries: TimeEntry[],
  keyOf: (e: TimeEntry) => string,
  _hoursPerDay: number,
): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const e of entries) {
    const key = keyOf(e) || "—";
    map.set(key, (map.get(key) ?? 0) + (e.days ?? 0));
  }
  return [...map.entries()];
}
