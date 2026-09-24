/**
 * Per-project calculation engine. Pure functions over a parsed Planner
 * project and its matched Timorc time entries. Nothing is stored; every view
 * derives from the same computations.
 */

import type { Project, Task } from "@/types/project";
import type { TimeEntry } from "@/types/time";
import type { AppSettings } from "@/lib/config";
import { clamp, daysBetween, effortToHours, ratio } from "@/lib/utils";
import { getSettings } from "@/store/settingsStore";

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

// Bucket names that mean done / blocked / in progress come from Settings.
const norm = (s: string) => s.trim().toLowerCase();
const inList = (list: string[], b: string) => {
  const n = norm(b);
  return list.some((x) => norm(x) === n);
};
export const isDoneBucket = (b: string, s: AppSettings = getSettings()) => inList(s.doneBuckets, b);
export const isBlockedBucket = (b: string, s: AppSettings = getSettings()) => inList(s.blockedBuckets, b);
export const isProgressBucket = (b: string, s: AppSettings = getSettings()) => inList(s.progressBuckets, b);

/**
 * Re-derive hour quantities from the raw efforts as written ("3 days"), so a
 * change to the hours-per-day setting applies to an already-imported board.
 */
export function withHoursPerDay(project: Project, hoursPerDay: number): Project {
  const c = project.charter;
  const budgetHours = c.budgetEffort != null ? effortToHours(c.budgetEffort, hoursPerDay) : c.budgetHours;
  return {
    ...project,
    charter: budgetHours === c.budgetHours ? c : { ...c, budgetHours },
    tasks: project.tasks.map((t) => {
      if (t.estimate == null) return t;
      const estimateHours = effortToHours(t.estimate, hoursPerDay);
      return estimateHours === t.estimateHours ? t : { ...t, estimateHours };
    }),
  };
}

export function isTaskDone(t: Task, s: AppSettings = getSettings()): boolean {
  return (
    isDoneBucket(t.bucket, s) ||
    t.endDate != null ||
    norm(t.progressStatus).startsWith("termin") ||
    (t.progressPct ?? 0) >= 100
  );
}

/** A task's completion 0–100: done ⇒ 100, else its entered progress (or 0). */
function taskProgress(t: Task, s: AppSettings): number {
  if (isTaskDone(t, s)) return 100;
  return Math.max(0, Math.min(100, t.progressPct ?? 0));
}

export function computeProjectMetrics(
  project: Project,
  entries: TimeEntry[],
  today: Date = new Date(),
  settings: AppSettings = getSettings(),
): ProjectMetrics {
  const { charter } = project;
  const { hoursPerDay } = settings;
  const done = (t: Task) => isTaskDone(t, settings);
  const progressOf = (t: Task) => taskProgress(t, settings);

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
  const tasksCompleted = project.tasks.filter(done).length;
  const tasksBlocked = project.tasks.filter((t) => isBlockedBucket(t.bucket, settings)).length;
  const tasksInProgress = project.tasks.filter((t) => isProgressBucket(t.bucket, settings)).length;
  const tasksOverdue = project.tasks.filter(
    (t) => !done(t) && (t.overdue || (t.dueDate != null && t.dueDate < today)),
  ).length;
  // Progress-aware completion: average of each task's % (done ⇒ 100).
  const taskCompletionPct =
    tasksTotal > 0
      ? project.tasks.reduce((s, t) => s + progressOf(t), 0) / tasksTotal
      : null;

  // Earned value of estimated work: Σ(estimate × progress) ÷ Σ(estimate).
  const estimateHoursTotal = project.tasks.reduce((s, t) => s + (t.estimateHours ?? 0), 0);
  const estimateHoursDone = project.tasks.reduce(
    (s, t) => s + (t.estimateHours ?? 0) * (progressOf(t) / 100),
    0,
  );
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
