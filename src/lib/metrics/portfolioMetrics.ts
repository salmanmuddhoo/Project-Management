/**
 * Cross-project aggregation for the executive dashboard.
 *
 * A `ProjectSnapshot` bundles a project with everything computed about it —
 * built once per import/filter change and shared by every widget so figures
 * always agree.
 */

import type { Project, RagStatus } from "@/types/project";
import { computeGovernance, type GovernanceResult } from "./governance";
import { computeHealthScore, ragOf, type HealthScore } from "./healthScore";
import { computeProjectMetrics, type ProjectMetrics } from "./projectMetrics";

export interface ProjectSnapshot {
  project: Project;
  metrics: ProjectMetrics;
  health: HealthScore;
  governance: GovernanceResult;
}

export function buildSnapshot(
  project: Project,
  today: Date = new Date(),
): ProjectSnapshot {
  const metrics = computeProjectMetrics(project, today);
  return {
    project,
    metrics,
    health: computeHealthScore(project, metrics),
    governance: computeGovernance(project, metrics),
  };
}

export interface PortfolioMetrics {
  totalProjects: number;
  onTrack: number;
  delayed: number;
  atRisk: number;
  completed: number;

  totalBudget: number;
  budgetUsed: number;
  budgetRemaining: number;

  totalPlannedHours: number;
  totalLoggedHours: number;
  remainingHours: number;

  /** Weighted average health (by budget when available, else equal). */
  portfolioHealthScore: number;
  portfolioRag: RagStatus;
}

const norm = (s: string) => s.trim().toLowerCase();

export function computePortfolioMetrics(
  snapshots: ProjectSnapshot[],
): PortfolioMetrics {
  const completed = snapshots.filter(
    (s) => norm(s.project.charter.status) === "completed",
  ).length;
  const delayed = snapshots.filter(
    (s) =>
      norm(s.project.charter.status) === "delayed" || s.metrics.daysDelayed > 0,
  ).length;
  const atRisk = snapshots.filter(
    (s) =>
      s.health.rag === "Red" || norm(s.project.charter.status) === "at risk",
  ).length;
  const active = snapshots.filter(
    (s) => !["completed", "cancelled"].includes(norm(s.project.charter.status)),
  );
  const onTrack = active.filter(
    (s) => s.health.rag === "Green" && s.metrics.daysDelayed === 0,
  ).length;

  const totalBudget = snapshots.reduce(
    (sum, s) => sum + s.metrics.budgetPlanned,
    0,
  );
  const budgetUsed = snapshots.reduce(
    (sum, s) => sum + s.metrics.budgetActual,
    0,
  );

  const totalPlannedHours = snapshots.reduce(
    (sum, s) => sum + s.metrics.totalPlannedHours,
    0,
  );
  const totalLoggedHours = snapshots.reduce(
    (sum, s) => sum + Math.max(s.metrics.loggedHours, s.metrics.totalActualHours),
    0,
  );
  const remainingHours = snapshots.reduce(
    (sum, s) => sum + s.metrics.totalRemainingHours,
    0,
  );

  // Budget-weighted health: big projects move the portfolio needle more.
  const weightOf = (s: ProjectSnapshot) =>
    s.metrics.budgetPlanned > 0 ? s.metrics.budgetPlanned : 1;
  const totalWeight = snapshots.reduce((sum, s) => sum + weightOf(s), 0);
  const portfolioHealthScore =
    snapshots.length > 0
      ? Math.round(
          snapshots.reduce((sum, s) => sum + s.health.score * weightOf(s), 0) /
            Math.max(1, totalWeight),
        )
      : 0;

  return {
    totalProjects: snapshots.length,
    onTrack,
    delayed,
    atRisk,
    completed,
    totalBudget,
    budgetUsed,
    budgetRemaining: totalBudget - budgetUsed,
    totalPlannedHours,
    totalLoggedHours,
    remainingHours,
    portfolioHealthScore,
    portfolioRag: ragOf(portfolioHealthScore),
  };
}

/**
 * Cross-project resource capacity view for the heat map: one row per
 * employee, aggregated allocation across every project they appear on.
 */
export interface CapacityRow {
  employee: string;
  department: string;
  totalAllocationPct: number;
  totalAvailableHours: number;
  totalPlannedHours: number;
  totalActualHours: number;
  projects: Array<{ projectName: string; allocationPct: number }>;
  overAllocated: boolean;
}

export function computeCapacity(snapshots: ProjectSnapshot[]): CapacityRow[] {
  const byEmployee = new Map<string, CapacityRow>();
  for (const s of snapshots) {
    for (const r of s.metrics.resourceInsights) {
      const key = norm(r.employee);
      if (!key) continue;
      let row = byEmployee.get(key);
      if (!row) {
        row = {
          employee: r.employee,
          department: r.department,
          totalAllocationPct: 0,
          totalAvailableHours: 0,
          totalPlannedHours: 0,
          totalActualHours: 0,
          projects: [],
          overAllocated: false,
        };
        byEmployee.set(key, row);
      }
      row.totalAllocationPct += r.allocationPct ?? 0;
      row.totalAvailableHours += r.availableHours ?? 0;
      row.totalPlannedHours += r.plannedHours ?? 0;
      row.totalActualHours += r.actualHours ?? 0;
      row.projects.push({
        projectName: s.project.charter.projectName,
        allocationPct: r.allocationPct ?? 0,
      });
    }
  }
  const rows = [...byEmployee.values()];
  for (const row of rows) {
    row.overAllocated =
      row.totalAllocationPct > 100 ||
      (row.totalAvailableHours > 0 &&
        row.totalPlannedHours > row.totalAvailableHours);
  }
  return rows.sort((a, b) => b.totalAllocationPct - a.totalAllocationPct);
}
