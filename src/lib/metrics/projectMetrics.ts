/**
 * Per-project calculation engine. Pure functions over the parsed Project —
 * nothing here is stored; dashboards, reports and exports all derive from
 * the same computations so figures can never disagree.
 */

import type { Project, ResourcePlan } from "@/types/project";
import { clamp, daysBetween, ratio } from "@/lib/utils";

export interface ResourceInsight extends ResourcePlan {
  /** Actual vs planned hours, 0–∞ (percent). */
  utilizationPct: number | null;
  /** Planned − actual, falling back to the sheet's own remaining column. */
  hoursRemaining: number | null;
  /** Available − planned. Negative ⇒ over capacity. */
  capacityHours: number | null;
  overAllocated: boolean;
  costVariance: number | null;
}

export interface ProjectMetrics {
  // Schedule
  durationDays: number | null;
  daysRemaining: number | null;
  /** Positive when the (forecast|actual) finish slips past the planned end. */
  daysDelayed: number;
  timeElapsedPct: number | null;
  /** Charter forecast, or linear extrapolation from progress when absent. */
  forecastEndDate: Date | null;

  // Budget
  budgetPlanned: number;
  budgetActual: number;
  budgetForecast: number;
  budgetConsumedPct: number | null;
  budgetVariance: number;
  budgetVariancePct: number | null;

  // Resources
  totalAvailableHours: number;
  totalPlannedHours: number;
  totalActualHours: number;
  totalRemainingHours: number;
  resourceUtilizationPct: number | null;
  resourceCostVariance: number;
  resourceInsights: ResourceInsight[];
  overallocated: ResourceInsight[];
  loggedHours: number;

  // Delivery
  tasksTotal: number;
  tasksDone: number;
  taskCompletionPct: number | null;
  milestonesTotal: number;
  milestonesCompleted: number;
  milestonesOverdue: number;
  milestoneCompletionPct: number | null;
  outputsTotal: number;
  outputsCompleted: number;
  outputsDelayed: number;
  outputsRemaining: number;
  outputCompletionPct: number | null;

  // Risk / issue exposure
  openRisks: number;
  openHighRisks: number;
  openIssues: number;
  openCriticalIssues: number;

  /** Blend of reported progress and computed delivery signals (0–100). */
  overallProgressPct: number;
}

const DONE_STATUSES = new Set(["completed", "done", "accepted", "closed"]);
const OPEN_STATUSES = new Set(["open", "in progress", "mitigating", ""]);

function isDone(status: string | null | undefined): boolean {
  return DONE_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

function isOpen(status: string | null | undefined): boolean {
  return OPEN_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

function isHigh(level: string | null | undefined): boolean {
  const norm = String(level ?? "").trim().toLowerCase();
  if (norm === "high" || norm === "critical") return true;
  const num = Number(norm);
  return Number.isFinite(num) && num >= 4; // 1–5 scales
}

export function computeResourceInsights(
  resources: ResourcePlan[],
): ResourceInsight[] {
  return resources.map((r) => {
    // Costs fall back to rate × hours when the columns were left blank.
    const plannedCost =
      r.plannedCost ??
      (r.hourlyRate != null && r.plannedHours != null
        ? r.hourlyRate * r.plannedHours
        : null);
    const actualCost =
      r.actualCost ??
      (r.hourlyRate != null && r.actualHours != null
        ? r.hourlyRate * r.actualHours
        : null);
    const hoursRemaining =
      r.plannedHours != null && r.actualHours != null
        ? Math.max(0, r.plannedHours - r.actualHours)
        : r.remainingHours;
    const capacityHours =
      r.availableHours != null && r.plannedHours != null
        ? r.availableHours - r.plannedHours
        : null;
    return {
      ...r,
      plannedCost,
      actualCost,
      utilizationPct:
        r.plannedHours != null && r.actualHours != null && r.plannedHours > 0
          ? (r.actualHours / r.plannedHours) * 100
          : null,
      hoursRemaining,
      capacityHours,
      overAllocated:
        (r.allocationPct != null && r.allocationPct > 100) ||
        (capacityHours != null && capacityHours < 0),
      costVariance:
        plannedCost != null && actualCost != null
          ? plannedCost - actualCost
          : null,
    };
  });
}

export function computeProjectMetrics(
  project: Project,
  today: Date = new Date(),
): ProjectMetrics {
  const { charter } = project;

  // -- Schedule -------------------------------------------------------------
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

  // -- Delivery signals (needed for forecast + progress) ---------------------
  const tasksTotal = project.backlog.length;
  const pointsOf = (sp: number | null) => sp ?? 1; // unpointed tasks weigh 1
  const totalPoints = project.backlog.reduce(
    (s, t) => s + pointsOf(t.storyPoints),
    0,
  );
  const donePoints = project.backlog
    .filter((t) => t.status === "Done")
    .reduce((s, t) => s + pointsOf(t.storyPoints), 0);
  const tasksDone = project.backlog.filter((t) => t.status === "Done").length;
  const taskCompletionPct =
    tasksTotal > 0 ? ratio(donePoints, totalPoints) * 100 : null;

  const milestonesTotal = project.milestones.length;
  const milestonesCompleted = project.milestones.filter(
    (m) => isDone(m.status) || (m.progressPct ?? 0) >= 100,
  ).length;
  const milestonesOverdue = project.milestones.filter(
    (m) =>
      !isDone(m.status) &&
      m.plannedDate != null &&
      m.plannedDate.getTime() < today.getTime(),
  ).length;
  const milestoneCompletionPct =
    milestonesTotal > 0 ? (milestonesCompleted / milestonesTotal) * 100 : null;

  const outputsTotal = project.outputs.length;
  const outputsCompleted = project.outputs.filter(
    (o) => isDone(o.status) || (o.completionPct ?? 0) >= 100,
  ).length;
  const outputsDelayed = project.outputs.filter((o) => {
    if (isDone(o.status)) return false;
    const norm = String(o.status ?? "").trim().toLowerCase();
    if (norm === "delayed") return true;
    return (
      o.plannedDeliveryDate != null &&
      o.plannedDeliveryDate.getTime() < today.getTime()
    );
  }).length;
  const outputCompletionPct =
    outputsTotal > 0
      ? project.outputs.reduce(
          (s, o) => s + clamp(o.completionPct ?? (isDone(o.status) ? 100 : 0), 0, 100),
          0,
        ) / outputsTotal
      : null;

  // -- Overall progress -------------------------------------------------------
  // Reported progress when provided, blended with computed delivery signals.
  const deliverySignals = [
    taskCompletionPct,
    milestoneCompletionPct,
    outputCompletionPct,
  ].filter((v): v is number => v != null);
  const computedProgress =
    deliverySignals.length > 0
      ? deliverySignals.reduce((a, b) => a + b, 0) / deliverySignals.length
      : null;
  const reported = charter.currentProgressPct;
  const overallProgressPct = clamp(
    reported != null && computedProgress != null
      ? reported * 0.5 + computedProgress * 0.5
      : (reported ?? computedProgress ?? 0),
    0,
    100,
  );

  // -- Forecast finish --------------------------------------------------------
  // Explicit forecast wins; otherwise extrapolate: at the current pace
  // (progress per elapsed day) how many days does 100% take?
  let forecastEndDate = charter.forecastEndDate;
  if (!forecastEndDate && start && plannedEnd && overallProgressPct > 0) {
    const elapsed = Math.max(1, daysBetween(start, today));
    if (elapsed > 7 && overallProgressPct < 100) {
      const totalNeeded = elapsed / (overallProgressPct / 100);
      forecastEndDate = new Date(
        start.getTime() + Math.round(totalNeeded) * 86_400_000,
      );
    } else {
      forecastEndDate = plannedEnd;
    }
  }

  const effectiveEnd = forecastEndDate ?? plannedEnd;
  const daysRemaining = effectiveEnd ? daysBetween(today, effectiveEnd) : null;
  const daysDelayed =
    plannedEnd && effectiveEnd
      ? Math.max(0, daysBetween(plannedEnd, effectiveEnd))
      : 0;

  // -- Budget -----------------------------------------------------------------
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

  // -- Resources ----------------------------------------------------------------
  const resourceInsights = computeResourceInsights(project.resources);
  const totalAvailableHours = resourceInsights.reduce(
    (s, r) => s + (r.availableHours ?? 0),
    0,
  );
  const totalPlannedHours = resourceInsights.reduce(
    (s, r) => s + (r.plannedHours ?? 0),
    0,
  );
  const totalActualHours = resourceInsights.reduce(
    (s, r) => s + (r.actualHours ?? 0),
    0,
  );
  const totalRemainingHours = resourceInsights.reduce(
    (s, r) => s + (r.hoursRemaining ?? 0),
    0,
  );
  const resourceCostVariance = resourceInsights.reduce(
    (s, r) => s + (r.costVariance ?? 0),
    0,
  );
  const loggedHours = project.timeTracking.reduce(
    (s, t) => s + (t.hours ?? 0),
    0,
  );

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

    totalAvailableHours,
    totalPlannedHours,
    totalActualHours,
    totalRemainingHours,
    resourceUtilizationPct:
      totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : null,
    resourceCostVariance,
    resourceInsights,
    overallocated: resourceInsights.filter((r) => r.overAllocated),
    loggedHours,

    tasksTotal,
    tasksDone,
    taskCompletionPct,
    milestonesTotal,
    milestonesCompleted,
    milestonesOverdue,
    milestoneCompletionPct,
    outputsTotal,
    outputsCompleted,
    outputsDelayed,
    outputsRemaining: outputsTotal - outputsCompleted,
    outputCompletionPct,

    openRisks: openRiskList.length,
    openHighRisks: openRiskList.filter(
      (r) => isHigh(r.probability) && isHigh(r.impact),
    ).length,
    openIssues: openIssueList.length,
    openCriticalIssues: openIssueList.filter((i) => isHigh(i.severity)).length,

    overallProgressPct,
  };
}
