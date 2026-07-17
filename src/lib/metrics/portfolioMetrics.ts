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

export function buildSnapshot(project: Project, today: Date = new Date()): ProjectSnapshot {
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
  totalActualHours: number;
  remainingHours: number;

  portfolioHealthScore: number;
  portfolioRag: RagStatus;
}

const norm = (s: string) => s.trim().toLowerCase();

export function computePortfolioMetrics(snapshots: ProjectSnapshot[]): PortfolioMetrics {
  const completed = snapshots.filter((s) => norm(s.project.charter.status) === "completed").length;
  const delayed = snapshots.filter(
    (s) => norm(s.project.charter.status) === "delayed" || s.metrics.daysDelayed > 0,
  ).length;
  const atRisk = snapshots.filter(
    (s) => s.health.rag === "Red" || norm(s.project.charter.status) === "at risk",
  ).length;
  const active = snapshots.filter(
    (s) => !["completed", "cancelled"].includes(norm(s.project.charter.status)),
  );
  const onTrack = active.filter((s) => s.health.rag === "Green" && s.metrics.daysDelayed === 0).length;

  const totalBudget = snapshots.reduce((sum, s) => sum + s.metrics.budgetPlanned, 0);
  const budgetUsed = snapshots.reduce((sum, s) => sum + s.metrics.budgetActual, 0);
  const totalPlannedHours = snapshots.reduce((sum, s) => sum + s.metrics.totalPlannedHours, 0);
  const totalActualHours = snapshots.reduce((sum, s) => sum + s.metrics.totalActualHours, 0);
  const remainingHours = snapshots.reduce((sum, s) => sum + s.metrics.totalRemainingHours, 0);

  const weightOf = (s: ProjectSnapshot) => (s.metrics.budgetPlanned > 0 ? s.metrics.budgetPlanned : 1);
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
    totalActualHours,
    remainingHours,
    portfolioHealthScore,
    portfolioRag: ragOf(portfolioHealthScore),
  };
}

/** Cross-project capacity view for the heat map: one row per person. */
export interface CapacityRow {
  name: string;
  role: string;
  totalAllocationPct: number;
  totalPlannedHours: number;
  totalActualHours: number;
  projects: Array<{ projectName: string; allocationPct: number }>;
  overAllocated: boolean;
}

export function computeCapacity(snapshots: ProjectSnapshot[]): CapacityRow[] {
  const byPerson = new Map<string, CapacityRow>();
  for (const s of snapshots) {
    for (const r of s.metrics.teamInsights) {
      const key = norm(r.name);
      if (!key) continue;
      let row = byPerson.get(key);
      if (!row) {
        row = {
          name: r.name,
          role: r.role,
          totalAllocationPct: 0,
          totalPlannedHours: 0,
          totalActualHours: 0,
          projects: [],
          overAllocated: false,
        };
        byPerson.set(key, row);
      }
      row.totalAllocationPct += r.allocationPct ?? 0;
      row.totalPlannedHours += r.plannedHours ?? 0;
      row.totalActualHours += r.actualHours ?? 0;
      row.projects.push({
        projectName: s.project.charter.projectName,
        allocationPct: r.allocationPct ?? 0,
      });
    }
  }
  const rows = [...byPerson.values()];
  for (const row of rows) row.overAllocated = row.totalAllocationPct > 100;
  return rows.sort((a, b) => b.totalAllocationPct - a.totalAllocationPct);
}
