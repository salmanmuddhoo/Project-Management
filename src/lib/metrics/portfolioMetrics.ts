/**
 * Cross-project aggregation for the executive dashboard.
 *
 * A `ProjectSnapshot` bundles a project with its matched time entries and
 * everything computed about it — built once per import/filter change.
 */

import type { Project, RagStatus } from "@/types/project";
import type { TimeEntry } from "@/types/time";
import { HOURS_PER_DAY } from "@/lib/config";
import { entriesForProject } from "@/lib/import/importFiles";
import { computeGovernance, type GovernanceResult } from "./governance";
import { computeHealthScore, ragOf, type HealthScore } from "./healthScore";
import { computeProjectMetrics, type ProjectMetrics } from "./projectMetrics";

export interface ProjectSnapshot {
  project: Project;
  entries: TimeEntry[];
  metrics: ProjectMetrics;
  health: HealthScore;
  governance: GovernanceResult;
}

export function buildSnapshot(
  project: Project,
  allEntries: TimeEntry[],
  today: Date = new Date(),
  hoursPerDay: number = HOURS_PER_DAY,
): ProjectSnapshot {
  const entries = entriesForProject(project, allEntries);
  const metrics = computeProjectMetrics(project, entries, today, hoursPerDay);
  return {
    project,
    entries,
    metrics,
    health: computeHealthScore(metrics),
    governance: computeGovernance(project, metrics),
  };
}

export interface PortfolioMetrics {
  totalProjects: number;
  onTrack: number;
  atRisk: number;
  overBudget: number;
  completed: number;

  totalBudgetHours: number;
  consumedHours: number;
  remainingHours: number;

  tasksTotal: number;
  tasksCompleted: number;

  portfolioHealthScore: number;
  portfolioRag: RagStatus;
}

export function computePortfolioMetrics(snapshots: ProjectSnapshot[]): PortfolioMetrics {
  const completed = snapshots.filter((s) => (s.metrics.taskCompletionPct ?? 0) >= 100).length;
  const atRisk = snapshots.filter((s) => s.health.rag === "Red").length;
  const onTrack = snapshots.filter((s) => s.health.rag === "Green").length;
  const overBudget = snapshots.filter((s) => s.metrics.overBudget).length;

  const totalBudgetHours = snapshots.reduce((n, s) => n + (s.metrics.budgetHours ?? 0), 0);
  const consumedHours = snapshots.reduce((n, s) => n + s.metrics.consumedHours, 0);
  const tasksTotal = snapshots.reduce((n, s) => n + s.metrics.tasksTotal, 0);
  const tasksCompleted = snapshots.reduce((n, s) => n + s.metrics.tasksCompleted, 0);

  const weightOf = (s: ProjectSnapshot) => (s.metrics.budgetHours && s.metrics.budgetHours > 0 ? s.metrics.budgetHours : 1);
  const totalWeight = snapshots.reduce((n, s) => n + weightOf(s), 0);
  const portfolioHealthScore =
    snapshots.length > 0
      ? Math.round(snapshots.reduce((n, s) => n + s.health.score * weightOf(s), 0) / Math.max(1, totalWeight))
      : 0;

  return {
    totalProjects: snapshots.length,
    onTrack,
    atRisk,
    overBudget,
    completed,
    totalBudgetHours,
    consumedHours,
    remainingHours: totalBudgetHours - consumedHours,
    tasksTotal,
    tasksCompleted,
    portfolioHealthScore,
    portfolioRag: ragOf(portfolioHealthScore),
  };
}

/** Cross-project time by person (who is spending the hours). */
export interface CapacityRow {
  name: string;
  totalHours: number;
  projects: Array<{ projectName: string; hours: number }>;
}

export function computeCapacity(snapshots: ProjectSnapshot[]): CapacityRow[] {
  const byPerson = new Map<string, CapacityRow>();
  for (const s of snapshots) {
    for (const r of s.metrics.byResource) {
      const key = r.name.trim().toLowerCase();
      if (!key) continue;
      let row = byPerson.get(key);
      if (!row) {
        row = { name: r.name, totalHours: 0, projects: [] };
        byPerson.set(key, row);
      }
      row.totalHours += r.hours;
      row.projects.push({ projectName: s.project.charter.projectName, hours: r.hours });
    }
  }
  return [...byPerson.values()].sort((a, b) => b.totalHours - a.totalHours);
}
