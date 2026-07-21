/**
 * Project health & risk model, adapted to the Planner + Timorc data.
 *
 * Three weighted dimensions (Schedule, Budget/time, Delivery) produce a 0–100
 * score and a RAG. Alongside the score we surface concrete risk reasons — the
 * "why" an executive needs. Dimensions with no data score a neutral 75.
 */

import type { RagStatus } from "@/types/project";
import { BEHIND_SCHEDULE_GAP, OVER_BUDGET_WARN_PCT } from "@/lib/config";
import { clamp } from "@/lib/utils";
import type { ProjectMetrics } from "./projectMetrics";

export interface HealthDimension {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  detail: string;
}

export interface RiskReason {
  severity: "critical" | "warning";
  message: string;
}

export interface HealthScore {
  score: number;
  rag: RagStatus;
  dimensions: HealthDimension[];
  reasons: RiskReason[];
}

export const HEALTH_WEIGHTS = { schedule: 0.35, budget: 0.35, delivery: 0.3 } as const;
const NEUTRAL = 75;

export function ragOf(score: number): RagStatus {
  if (score >= 80) return "Green";
  if (score >= 60) return "Amber";
  return "Red";
}

export function computeHealthScore(m: ProjectMetrics): HealthScore {
  const dims: HealthDimension[] = [];
  const reasons: RiskReason[] = [];

  // -- Schedule -------------------------------------------------------------
  {
    let score: number | null = null;
    let detail = "No dates set";
    if (m.timeElapsedPct != null) {
      const lag = Math.max(0, m.timeElapsedPct - m.overallProgressPct);
      score = clamp(100 - lag * 1.5 - m.tasksOverdue * 8, 0, 100);
      detail =
        m.daysRemaining != null && m.daysRemaining < 0
          ? `${Math.abs(m.daysRemaining)} day(s) past end date`
          : `${Math.round(m.timeElapsedPct)}% elapsed, ${Math.round(m.overallProgressPct)}% done`;
      if (lag > BEHIND_SCHEDULE_GAP) {
        reasons.push({
          severity: lag > 40 ? "critical" : "warning",
          message: `Behind schedule — ${Math.round(m.timeElapsedPct)}% of time elapsed but only ${Math.round(m.overallProgressPct)}% of tasks done.`,
        });
      }
      if (m.overdue) reasons.push({ severity: "critical", message: "Past its end date and not complete." });
      if (m.tasksOverdue > 0) {
        reasons.push({
          severity: m.tasksOverdue >= 3 ? "critical" : "warning",
          message: `${m.tasksOverdue} overdue task(s).`,
        });
      }
    }
    dims.push({ key: "schedule", label: "Schedule", weight: HEALTH_WEIGHTS.schedule, score, detail });
  }

  // -- Budget (time) --------------------------------------------------------
  {
    let score: number | null = null;
    let detail = "No hours budget / time logged";
    if (m.budgetConsumedPct != null) {
      const overPct = Math.max(0, m.budgetConsumedPct - 100);
      score = clamp(100 - overPct * 2.5, 0, 100);
      // Burn running ahead of delivery is also a risk.
      const burnAhead = Math.max(0, m.budgetConsumedPct - m.overallProgressPct);
      score = clamp(score - burnAhead * 0.4, 0, 100);
      detail = `${Math.round(m.consumedHours)}h of ${Math.round(m.budgetHours ?? 0)}h used (${Math.round(m.budgetConsumedPct)}%)`;
      if (m.overBudget) {
        reasons.push({
          severity: "critical",
          message: `Over budget — ${Math.round(m.consumedHours)}h used against a ${Math.round(m.budgetHours ?? 0)}h budget.`,
        });
      } else if (m.budgetConsumedPct >= OVER_BUDGET_WARN_PCT) {
        reasons.push({
          severity: "warning",
          message: `Budget nearly exhausted — ${Math.round(m.budgetConsumedPct)}% of hours used.`,
        });
      }
      if (burnAhead > 25 && !m.overBudget) {
        reasons.push({
          severity: "warning",
          message: `Hours are burning faster than delivery (${Math.round(m.budgetConsumedPct)}% budget vs ${Math.round(m.overallProgressPct)}% done).`,
        });
      }
    } else if (m.budgetHours != null && m.timeEntryCount === 0) {
      reasons.push({ severity: "warning", message: "No time logged yet against this project's Timorc code." });
    }
    dims.push({ key: "budget", label: "Budget (time)", weight: HEALTH_WEIGHTS.budget, score, detail });
  }

  // -- Delivery -------------------------------------------------------------
  {
    let score: number | null = null;
    let detail = "No tasks";
    if (m.tasksTotal > 0) {
      score = clamp(m.overallProgressPct + 40 - m.tasksBlocked * 12 - m.tasksOverdue * 6, 0, 100);
      detail = `${m.tasksCompleted}/${m.tasksTotal} done · ${m.tasksInProgress} in progress · ${m.tasksBlocked} blocked`;
      if (m.tasksBlocked > 0) {
        reasons.push({
          severity: m.tasksBlocked >= 2 ? "warning" : "warning",
          message: `${m.tasksBlocked} blocked task(s).`,
        });
      }
    }
    dims.push({ key: "delivery", label: "Delivery", weight: HEALTH_WEIGHTS.delivery, score, detail });
  }

  const total = dims.reduce((s, d) => s + (d.score ?? NEUTRAL) * d.weight, 0);
  const score = Math.round(clamp(total, 0, 100));
  const order = { critical: 0, warning: 1 } as const;
  reasons.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score, rag: ragOf(score), dimensions: dims, reasons };
}
