/**
 * Per-dimension traffic lights for the Overview — a discrete, rule-based RAG for
 * Schedule, Budget and Deliverables, plus a project lifecycle state derived from
 * the Planner buckets.
 *
 * Unlike the weighted 0–100 health score (`healthScore.ts`), these lights are
 * intentionally simple and explainable: each is decided by a small set of
 * thresholds (see `src/lib/config.ts` and docs/METRICS.md §3.5) and carries a
 * one-line "reason" stating exactly why it is the colour it is.
 *
 * Colours follow the master Excel vocabulary:
 *   green  — on track            amber — at risk / watch
 *   red    — off track           blue  — complete
 *   grey   — not started / no data
 */

import type { Project } from "@/types/project";
import {
  BUDGET_BURN_AHEAD_AMBER_PCT,
  DELIVERY_BLOCKED_RED,
  OVER_BUDGET_RED_PCT,
  OVER_BUDGET_WARN_PCT,
  OVERDUE_TASKS_RED,
  SCHEDULE_LATE_AMBER_DAYS,
  SCHEDULE_LATE_RED_DAYS,
} from "@/lib/config";
import { daysBetween } from "@/lib/utils";
import { isDoneBucket, isBlockedBucket, isProgressBucket } from "./projectMetrics";
import type { ProjectMetrics } from "./projectMetrics";

export type LightColor = "green" | "amber" | "red" | "blue" | "grey";

/** Where the project sits in its life, inferred from the board buckets. */
export type LifecycleState = "not-started" | "active" | "complete";

export interface TrafficLight {
  key: "schedule" | "budget" | "deliverables";
  label: string;
  color: LightColor;
  /** One-line justification for the colour, shown in the UI. */
  reason: string;
}

export interface ProjectStatusLights {
  lifecycle: LifecycleState;
  /** Grey if not started, Blue if complete, else the worst of the three lights. */
  overall: LightColor;
  schedule: TrafficLight;
  budget: TrafficLight;
  deliverables: TrafficLight;
}

/**
 * Lifecycle from the board (the Project Charter card is already excluded from
 * `project.tasks`, so only real work cards are considered):
 *  - complete    — there is work and every card sits in a "done" bucket
 *  - not-started — there is no card in an In Progress / Blocked / Completed
 *                  bucket (nothing has moved yet), or there are no cards at all
 *  - active      — anything in between
 */
export function computeLifecycle(project: Project): LifecycleState {
  const tasks = project.tasks;
  if (tasks.length === 0) return "not-started";

  const done = tasks.filter((t) => isDoneBucket(t.bucket)).length;
  if (done === tasks.length) return "complete";

  const started = tasks.filter(
    (t) => isProgressBucket(t.bucket) || isBlockedBucket(t.bucket) || isDoneBucket(t.bucket),
  ).length;
  if (started === 0) return "not-started";

  return "active";
}

/** Rank used to pick the worst light for the overall status. */
const SEVERITY: Record<LightColor, number> = { red: 3, amber: 2, green: 1, blue: 0, grey: 0 };

function scheduleLight(m: ProjectMetrics, today: Date): TrafficLight {
  const base = { key: "schedule" as const, label: "Schedule" };
  if (m.startDate == null || m.endDate == null) {
    return { ...base, color: "grey", reason: "No start/end dates on the charter." };
  }

  // Lateness in days — the worst of three independent measures.
  const overdueDays = m.overdue && m.endDate < today ? daysBetween(m.endDate, today) : 0;
  const behindPaceDays =
    m.durationDays != null && m.timeElapsedPct != null
      ? Math.max(0, ((m.timeElapsedPct - m.overallProgressPct) / 100) * m.durationDays)
      : 0;
  const lateDays = Math.max(overdueDays, behindPaceDays);

  let reason: string;
  if (overdueDays >= behindPaceDays && overdueDays > 0) {
    reason = `Past the end date by ${Math.round(overdueDays)} day(s), not yet complete.`;
  } else if (behindPaceDays > 0) {
    reason = `Behind pace — ${Math.round(m.timeElapsedPct ?? 0)}% of time elapsed vs ${Math.round(
      m.overallProgressPct,
    )}% done (~${Math.round(behindPaceDays)} day(s) behind).`;
  } else {
    reason = `On schedule — ${Math.round(m.timeElapsedPct ?? 0)}% elapsed, ${Math.round(
      m.overallProgressPct,
    )}% done.`;
  }

  const color: LightColor =
    lateDays >= SCHEDULE_LATE_RED_DAYS ? "red" : lateDays >= SCHEDULE_LATE_AMBER_DAYS ? "amber" : "green";
  return { ...base, color, reason };
}

function budgetLight(m: ProjectMetrics): TrafficLight {
  const base = { key: "budget" as const, label: "Budget" };
  if (m.budgetConsumedPct == null) {
    return { ...base, color: "grey", reason: "No hours budget / no time logged yet." };
  }

  const pct = Math.round(m.budgetConsumedPct);
  const burnAhead = Math.max(0, m.budgetConsumedPct - m.overallProgressPct);

  if (m.budgetConsumedPct >= OVER_BUDGET_RED_PCT) {
    return { ...base, color: "red", reason: `Over budget — ${pct}% of hours used.` };
  }
  if (m.budgetConsumedPct >= OVER_BUDGET_WARN_PCT) {
    return { ...base, color: "amber", reason: `Budget nearly exhausted — ${pct}% of hours used.` };
  }
  if (burnAhead > BUDGET_BURN_AHEAD_AMBER_PCT) {
    return {
      ...base,
      color: "amber",
      reason: `Hours burning ahead of delivery — ${pct}% budget used vs ${Math.round(
        m.overallProgressPct,
      )}% done.`,
    };
  }
  return { ...base, color: "green", reason: `Within budget — ${pct}% of hours used.` };
}

function deliverablesLight(m: ProjectMetrics): TrafficLight {
  const base = { key: "deliverables" as const, label: "Deliverables" };
  if (m.tasksTotal === 0) {
    return { ...base, color: "grey", reason: "No work tasks on the board." };
  }

  if (m.tasksOverdue >= OVERDUE_TASKS_RED || m.tasksBlocked >= DELIVERY_BLOCKED_RED) {
    return {
      ...base,
      color: "red",
      reason: `${m.tasksOverdue} overdue, ${m.tasksBlocked} blocked of ${m.tasksTotal} tasks.`,
    };
  }
  if (m.tasksOverdue >= 1 || m.tasksBlocked >= 1) {
    return {
      ...base,
      color: "amber",
      reason: `${m.tasksOverdue} overdue, ${m.tasksBlocked} blocked of ${m.tasksTotal} tasks.`,
    };
  }
  return {
    ...base,
    color: "green",
    reason: `${m.tasksCompleted}/${m.tasksTotal} done, none overdue or blocked.`,
  };
}

export function computeStatusLights(
  project: Project,
  m: ProjectMetrics,
  today: Date = new Date(),
): ProjectStatusLights {
  const lifecycle = computeLifecycle(project);
  const schedule = scheduleLight(m, today);
  const budget = budgetLight(m);
  const deliverables = deliverablesLight(m);

  let overall: LightColor;
  if (lifecycle === "not-started") overall = "grey";
  else if (lifecycle === "complete") overall = "blue";
  else {
    overall = [schedule, budget, deliverables]
      .map((l) => l.color)
      .reduce<LightColor>((worst, c) => (SEVERITY[c] > SEVERITY[worst] ? c : worst), "green");
  }

  return { lifecycle, overall, schedule, budget, deliverables };
}
