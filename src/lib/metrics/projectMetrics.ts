/**
 * Per-project calculation engine. Pure functions over the parsed Project —
 * nothing here is stored; dashboards, reports and exports all derive from
 * the same computations so figures can never disagree.
 */

import type { Project, TeamMember } from "@/types/project";
import { clamp, daysBetween, ratio } from "@/lib/utils";

export interface TeamInsight extends TeamMember {
  plannedCost: number | null;
  actualCost: number | null;
  /** Actual vs planned hours (percent). */
  utilizationPct: number | null;
  hoursRemaining: number | null;
  /** Allocation over 100%. */
  overAllocated: boolean;
  costVariance: number | null;
}

export interface ProjectMetrics {
  // Schedule
  durationDays: number | null;
  daysRemaining: number | null;
  daysDelayed: number;
  timeElapsedPct: number | null;
  forecastEndDate: Date | null;

  // Budget
  budgetPlanned: number;
  budgetActual: number;
  budgetForecast: number;
  budgetConsumedPct: number | null;
  budgetVariance: number;
  budgetVariancePct: number | null;

  // Team
  totalPlannedHours: number;
  totalActualHours: number;
  totalRemainingHours: number;
  resourceUtilizationPct: number | null;
  resourceCostVariance: number;
  teamInsights: TeamInsight[];
  overallocated: TeamInsight[];

  // Delivery
  tasksTotal: number;
  tasksDone: number;
  taskCompletionPct: number | null;
  milestonesTotal: number;
  milestonesCompleted: number;
  milestonesOverdue: number;
  milestoneCompletionPct: number | null;
  deliverablesTotal: number;
  deliverablesCompleted: number;
  deliverablesDelayed: number;
  deliverablesRemaining: number;
  deliverableCompletionPct: number | null;

  // Risk / issue exposure
  openRisks: number;
  openHighRisks: number;
  openIssues: number;
  openCriticalIssues: number;

  /** Computed from delivery signals (0–100). */
  overallProgressPct: number;
}

const DONE_STATUSES = new Set(["completed", "done", "accepted", "closed"]);
const OPEN_STATUSES = new Set(["open", "in progress", "mitigating", ""]);

const isDone = (s: string | null | undefined) =>
  DONE_STATUSES.has(String(s ?? "").trim().toLowerCase());
const isOpen = (s: string | null | undefined) =>
  OPEN_STATUSES.has(String(s ?? "").trim().toLowerCase());

function isHigh(level: string | null | undefined): boolean {
  const norm = String(level ?? "").trim().toLowerCase();
  if (norm === "high" || norm === "critical") return true;
  const num = Number(norm);
  return Number.isFinite(num) && num >= 4;
}

export function computeTeamInsights(team: TeamMember[]): TeamInsight[] {
  return team.map((r) => {
    const plannedCost =
      r.hourlyRate != null && r.plannedHours != null
        ? r.hourlyRate * r.plannedHours
        : null;
    const actualCost =
      r.hourlyRate != null && r.actualHours != null
        ? r.hourlyRate * r.actualHours
        : null;
    const hoursRemaining =
      r.plannedHours != null && r.actualHours != null
        ? Math.max(0, r.plannedHours - r.actualHours)
        : null;
    return {
      ...r,
      plannedCost,
      actualCost,
      hoursRemaining,
      utilizationPct:
        r.plannedHours != null && r.actualHours != null && r.plannedHours > 0
          ? (r.actualHours / r.plannedHours) * 100
          : null,
      overAllocated: r.allocationPct != null && r.allocationPct > 100,
      costVariance:
        plannedCost != null && actualCost != null ? plannedCost - actualCost : null,
    };
  });
}

export function computeProjectMetrics(
  project: Project,
  today: Date = new Date(),
): ProjectMetrics {
  const { charter } = project;

  const start = charter.actualStartDate ?? charter.plannedStartDate;
  const plannedEnd = charter.plannedEndDate;
  const durationDays =
    charter.plannedStartDate && plannedEnd
      ? daysBetween(charter.plannedStartDate, plannedEnd)
      : null;
  const timeElapsedPct =
    start && plannedEnd
      ? clamp(
          ratio(daysBetween(start, today), Math.max(1, daysBetween(start, plannedEnd))) * 100,
          0,
          100,
        )
      : null;

  // -- Delivery -------------------------------------------------------------
  const tasksTotal = project.tasks.length;
  const tasksDone = project.tasks.filter((t) => t.status === "Done").length;
  const taskCompletionPct =
    tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : null;

  const milestonesTotal = project.milestones.length;
  const milestonesCompleted = project.milestones.filter((m) =>
    isDone(m.status),
  ).length;
  const milestonesOverdue = project.milestones.filter(
    (m) => !isDone(m.status) && m.plannedDate != null && m.plannedDate < today,
  ).length;
  const milestoneCompletionPct =
    milestonesTotal > 0 ? (milestonesCompleted / milestonesTotal) * 100 : null;

  const deliverablesTotal = project.deliverables.length;
  const deliverablesCompleted = project.deliverables.filter(
    (o) => isDone(o.status) || (o.completionPct ?? 0) >= 100,
  ).length;
  const deliverablesDelayed = project.deliverables.filter((o) => {
    if (isDone(o.status)) return false;
    if (String(o.status ?? "").trim().toLowerCase() === "delayed") return true;
    return o.dueDate != null && o.dueDate < today;
  }).length;
  const deliverableCompletionPct =
    deliverablesTotal > 0
      ? project.deliverables.reduce(
          (s, o) => s + clamp(o.completionPct ?? (isDone(o.status) ? 100 : 0), 0, 100),
          0,
        ) / deliverablesTotal
      : null;

  // -- Overall progress (computed only) -------------------------------------
  const signals = [
    taskCompletionPct,
    milestoneCompletionPct,
    deliverableCompletionPct,
  ].filter((v): v is number => v != null);
  const overallProgressPct = clamp(
    signals.length > 0 ? signals.reduce((a, b) => a + b, 0) / signals.length : 0,
    0,
    100,
  );

  // -- Forecast finish ------------------------------------------------------
  let forecastEndDate: Date | null = plannedEnd;
  if (start && plannedEnd) {
    const elapsed = Math.max(1, daysBetween(start, today));
    if (elapsed > 7 && overallProgressPct > 0 && overallProgressPct < 100) {
      const totalNeeded = elapsed / (overallProgressPct / 100);
      forecastEndDate = new Date(start.getTime() + Math.round(totalNeeded) * 86_400_000);
    }
  }
  const effectiveEnd = forecastEndDate ?? plannedEnd;
  const daysRemaining = effectiveEnd ? daysBetween(today, effectiveEnd) : null;
  const daysDelayed =
    plannedEnd && effectiveEnd ? Math.max(0, daysBetween(plannedEnd, effectiveEnd)) : 0;

  // -- Budget ---------------------------------------------------------------
  const sheetPlanned = project.budget.reduce((s, b) => s + (b.planned ?? 0), 0);
  const budgetPlanned = charter.budget ?? sheetPlanned;
  const budgetActual = project.budget.reduce((s, b) => s + (b.actual ?? 0), 0);
  const sheetForecast = project.budget.reduce(
    (s, b) => s + (b.forecast ?? b.actual ?? 0),
    0,
  );
  const budgetForecast = sheetForecast > 0 ? sheetForecast : budgetActual;
  const budgetConsumedPct =
    budgetPlanned > 0 ? (budgetActual / budgetPlanned) * 100 : null;
  const budgetVariance = budgetPlanned - budgetForecast;
  const budgetVariancePct =
    budgetPlanned > 0 ? (budgetVariance / budgetPlanned) * 100 : null;

  // -- Team -----------------------------------------------------------------
  const teamInsights = computeTeamInsights(project.team);
  const totalPlannedHours = teamInsights.reduce((s, r) => s + (r.plannedHours ?? 0), 0);
  const totalActualHours = teamInsights.reduce((s, r) => s + (r.actualHours ?? 0), 0);
  const totalRemainingHours = teamInsights.reduce((s, r) => s + (r.hoursRemaining ?? 0), 0);
  const resourceCostVariance = teamInsights.reduce((s, r) => s + (r.costVariance ?? 0), 0);

  // -- Risks & issues -------------------------------------------------------
  const openRiskList = project.risks.filter((r) => isOpen(r.status));
  const openIssueList = project.issues.filter((i) => isOpen(i.status));

  return {
    durationDays,
    daysRemaining,
    daysDelayed,
    timeElapsedPct,
    forecastEndDate,

    budgetPlanned,
    budgetActual,
    budgetForecast,
    budgetConsumedPct,
    budgetVariance,
    budgetVariancePct,

    totalPlannedHours,
    totalActualHours,
    totalRemainingHours,
    resourceUtilizationPct:
      totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : null,
    resourceCostVariance,
    teamInsights,
    overallocated: teamInsights.filter((r) => r.overAllocated),

    tasksTotal,
    tasksDone,
    taskCompletionPct,
    milestonesTotal,
    milestonesCompleted,
    milestonesOverdue,
    milestoneCompletionPct,
    deliverablesTotal,
    deliverablesCompleted,
    deliverablesDelayed,
    deliverablesRemaining: deliverablesTotal - deliverablesCompleted,
    deliverableCompletionPct,

    openRisks: openRiskList.length,
    openHighRisks: openRiskList.filter((r) => isHigh(r.impact) && isHigh(r.likelihood)).length,
    openIssues: openIssueList.length,
    openCriticalIssues: openIssueList.filter((i) => isHigh(i.severity)).length,

    overallProgressPct,
  };
}
