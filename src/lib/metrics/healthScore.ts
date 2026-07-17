/**
 * Weighted project health model.
 *
 * Eight dimensions, each scored 0–100, combined with the standard company
 * weighting (docs/ARCHITECTURE.md §6). RAG bands: Green ≥ 80, Amber ≥ 60,
 * Red < 60. Dimensions with no data score a neutral 75 so a sparse workbook
 * is "amber-ish", never artificially green or red.
 */

import type { Project, RagStatus } from "@/types/project";
import { clamp } from "@/lib/utils";
import type { ProjectMetrics } from "./projectMetrics";

export interface HealthDimension {
  key: string;
  label: string;
  weight: number;
  /** 0–100; null when the workbook has no data for this dimension. */
  score: number | null;
  detail: string;
}

export interface HealthScore {
  score: number;
  rag: RagStatus;
  dimensions: HealthDimension[];
}

export const HEALTH_WEIGHTS = {
  schedule: 0.25,
  budget: 0.2,
  resources: 0.15,
  milestones: 0.1,
  backlog: 0.1,
  deliverables: 0.1,
  risks: 0.05,
  issues: 0.05,
} as const;

const NEUTRAL = 75;

export function ragOf(score: number): RagStatus {
  if (score >= 80) return "Green";
  if (score >= 60) return "Amber";
  return "Red";
}

export function computeHealthScore(
  project: Project,
  m: ProjectMetrics,
): HealthScore {
  const dims: HealthDimension[] = [];

  // Schedule: penalize slip relative to total duration.
  {
    let score: number | null = null;
    let detail = "No schedule data";
    if (m.durationDays != null && m.durationDays > 0) {
      const slipRatio = m.daysDelayed / m.durationDays;
      score = clamp(100 - slipRatio * 250, 0, 100); // 20% slip ⇒ 50pts
      detail =
        m.daysDelayed > 0
          ? `Forecast ${m.daysDelayed} day(s) late`
          : "On schedule";
    }
    dims.push({ key: "schedule", label: "Schedule", weight: HEALTH_WEIGHTS.schedule, score, detail });
  }

  // Budget: penalize overrun; mild penalty for burn far ahead of progress.
  {
    let score: number | null = null;
    let detail = "No budget data";
    if (m.budgetPlanned > 0) {
      const overrunPct = Math.max(0, -(m.budgetVariancePct ?? 0));
      score = clamp(100 - overrunPct * 2.5, 0, 100); // 20% overrun ⇒ 50pts
      const burnAhead =
        m.budgetConsumedPct != null
          ? Math.max(0, m.budgetConsumedPct - m.overallProgressPct)
          : 0;
      score = clamp(score - burnAhead * 0.5, 0, 100);
      detail =
        overrunPct > 0
          ? `Forecast overrun ${Math.round(overrunPct)}%`
          : "Within budget";
    }
    dims.push({ key: "budget", label: "Budget", weight: HEALTH_WEIGHTS.budget, score, detail });
  }

  // Resources: over-allocation share of the team.
  {
    let score: number | null = null;
    let detail = "No resource plan";
    if (m.resourceInsights.length > 0) {
      const overShare = m.overallocated.length / m.resourceInsights.length;
      score = clamp(100 - overShare * 150, 0, 100);
      detail =
        m.overallocated.length > 0
          ? `${m.overallocated.length} over-allocated resource(s)`
          : "Capacity healthy";
    }
    dims.push({ key: "resources", label: "Resources", weight: HEALTH_WEIGHTS.resources, score, detail });
  }

  // Milestones: overdue share dominates.
  {
    let score: number | null = null;
    let detail = "No milestones";
    if (m.milestonesTotal > 0) {
      const overdueShare = m.milestonesOverdue / m.milestonesTotal;
      score = clamp(100 - overdueShare * 200, 0, 100);
      detail =
        m.milestonesOverdue > 0
          ? `${m.milestonesOverdue} overdue milestone(s)`
          : `${m.milestonesCompleted}/${m.milestonesTotal} complete`;
    }
    dims.push({ key: "milestones", label: "Milestones", weight: HEALTH_WEIGHTS.milestones, score, detail });
  }

  // Backlog: completion vs time elapsed.
  {
    let score: number | null = null;
    let detail = "No backlog";
    if (m.taskCompletionPct != null) {
      const lag =
        m.timeElapsedPct != null
          ? Math.max(0, m.timeElapsedPct - m.taskCompletionPct)
          : 0;
      score = clamp(100 - lag * 1.5, 0, 100);
      detail = `${Math.round(m.taskCompletionPct)}% of work done`;
    }
    dims.push({ key: "backlog", label: "Backlog Progress", weight: HEALTH_WEIGHTS.backlog, score, detail });
  }

  // Deliverables: delayed share of expected outputs.
  {
    let score: number | null = null;
    let detail = "No expected outputs";
    if (m.outputsTotal > 0) {
      const delayedShare = m.outputsDelayed / m.outputsTotal;
      score = clamp(100 - delayedShare * 200, 0, 100);
      detail =
        m.outputsDelayed > 0
          ? `${m.outputsDelayed} delayed output(s)`
          : `${m.outputsCompleted}/${m.outputsTotal} complete`;
    }
    dims.push({ key: "deliverables", label: "Deliverables", weight: HEALTH_WEIGHTS.deliverables, score, detail });
  }

  // Risks: open high-probability × high-impact items.
  {
    const score =
      project.risks.length === 0
        ? null
        : clamp(100 - m.openHighRisks * 25 - (m.openRisks - m.openHighRisks) * 5, 0, 100);
    dims.push({
      key: "risks",
      label: "Risks",
      weight: HEALTH_WEIGHTS.risks,
      score,
      detail:
        project.risks.length === 0
          ? "No risk register"
          : `${m.openRisks} open (${m.openHighRisks} high)`,
    });
  }

  // Issues: open critical/high severity items.
  {
    const score =
      project.issues.length === 0
        ? null
        : clamp(100 - m.openCriticalIssues * 25 - (m.openIssues - m.openCriticalIssues) * 5, 0, 100);
    dims.push({
      key: "issues",
      label: "Issues",
      weight: HEALTH_WEIGHTS.issues,
      score,
      detail:
        project.issues.length === 0
          ? "No issue log"
          : `${m.openIssues} open (${m.openCriticalIssues} critical/high)`,
    });
  }

  const total = dims.reduce(
    (sum, d) => sum + (d.score ?? NEUTRAL) * d.weight,
    0,
  );
  const score = Math.round(clamp(total, 0, 100));
  return { score, rag: ragOf(score), dimensions: dims };
}
