/**
 * Project health & risk model, adapted to the Planner + Timorc data.
 *
 * Three weighted dimensions (Schedule, Budget/time, Delivery) produce a 0–100
 * score and a RAG. Alongside the score we surface concrete risk reasons — the
 * "why" an executive needs. Dimensions with no data score a neutral 75.
 *
 * Where EVM is available we blend in the standard indices: SPI into the
 * Schedule dimension and CPI into the Budget dimension. Finally, a set of
 * hard-stop rules can force the overall RAG to Red regardless of the weighted
 * score (past the end date, well over budget, or many overdue tasks).
 */

import type { RagStatus } from "@/types/project";
import {
  BEHIND_SCHEDULE_GAP,
  CPI_WARN,
  OVER_BUDGET_RED_PCT,
  OVER_BUDGET_WARN_PCT,
  OVERDUE_TASKS_RED,
  SPI_WARN,
} from "@/lib/config";
import { clamp } from "@/lib/utils";
import type { EvmResult } from "./evm";
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
  /** True when a hard-stop rule forced the RAG to Red below its scored value. */
  ragForcedRed: boolean;
}

// On-time delivery is the priority, so Schedule carries the most weight.
export const HEALTH_WEIGHTS = { schedule: 0.4, budget: 0.3, delivery: 0.3 } as const;
const NEUTRAL = 75;

/** Map an EVM index (SPI/CPI, 1 = on plan) to a 0–100 dimension score. */
function indexScore(index: number): number {
  return clamp(index * 100, 0, 100);
}

export function ragOf(score: number): RagStatus {
  if (score >= 80) return "Green";
  if (score >= 60) return "Amber";
  return "Red";
}

export function computeHealthScore(m: ProjectMetrics, evm?: EvmResult): HealthScore {
  const dims: HealthDimension[] = [];
  const reasons: RiskReason[] = [];

  const spi = evm?.spi ?? null;
  const cpi = evm?.units[0]?.cpi ?? null;

  // -- Schedule -------------------------------------------------------------
  {
    let score: number | null = null;
    let detail = "No dates set";
    if (m.timeElapsedPct != null) {
      const lag = Math.max(0, m.timeElapsedPct - m.overallProgressPct);
      let base = clamp(100 - lag * 1.5, 0, 100);
      // Blend in SPI (a standard EVM schedule measure) when we have it.
      if (spi != null) base = (base + indexScore(spi)) / 2;
      score = clamp(base - m.tasksOverdue * 8, 0, 100);
      detail =
        m.daysRemaining != null && m.daysRemaining < 0
          ? `${Math.abs(m.daysRemaining)} day(s) past end date`
          : `${Math.round(m.timeElapsedPct)}% elapsed, ${Math.round(m.overallProgressPct)}% done${spi != null ? ` · SPI ${spi.toFixed(2)}` : ""}`;
      if (lag > BEHIND_SCHEDULE_GAP) {
        reasons.push({
          severity: lag > 40 ? "critical" : "warning",
          message: `Behind schedule — ${Math.round(m.timeElapsedPct)}% of time elapsed but only ${Math.round(m.overallProgressPct)}% of tasks done.`,
        });
      }
      if (spi != null && spi < SPI_WARN) {
        reasons.push({
          severity: spi < 0.75 ? "critical" : "warning",
          message: `Schedule performance behind plan — SPI ${spi.toFixed(2)} (earned vs planned value).`,
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
      let base = clamp(100 - overPct * 2.5, 0, 100);
      // Burn running ahead of delivery is also a risk.
      const burnAhead = Math.max(0, m.budgetConsumedPct - m.overallProgressPct);
      base = clamp(base - burnAhead * 0.4, 0, 100);
      // Blend in CPI (a standard EVM budget-efficiency measure) when we have it.
      score = cpi != null ? (base + indexScore(cpi)) / 2 : base;
      detail = `${Math.round(m.consumedHours)}h of ${Math.round(m.budgetHours ?? 0)}h used (${Math.round(m.budgetConsumedPct)}%)${cpi != null ? ` · CPI ${cpi.toFixed(2)}` : ""}`;
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
      if (cpi != null && cpi < CPI_WARN && !m.overBudget) {
        reasons.push({
          severity: cpi < 0.75 ? "critical" : "warning",
          message: `Cost efficiency below plan — CPI ${cpi.toFixed(2)} (earned value per hour spent).`,
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
          severity: "warning",
          message: `${m.tasksBlocked} blocked task(s).`,
        });
      }
    }
    dims.push({ key: "delivery", label: "Delivery", weight: HEALTH_WEIGHTS.delivery, score, detail });
  }

  const total = dims.reduce((s, d) => s + (d.score ?? NEUTRAL) * d.weight, 0);
  const score = Math.round(clamp(total, 0, 100));

  // -- Hard-stop rules: force Red for the conditions executives can't ignore.
  let rag = ragOf(score);
  const hardStops: string[] = [];
  if (m.overdue) hardStops.push("past its end date and not complete");
  if (m.budgetConsumedPct != null && m.budgetConsumedPct >= OVER_BUDGET_RED_PCT) {
    hardStops.push(`significantly over budget (${Math.round(m.budgetConsumedPct)}% of hours used)`);
  }
  if (m.tasksOverdue >= OVERDUE_TASKS_RED) {
    hardStops.push(`${m.tasksOverdue} overdue tasks`);
  }
  const ragForcedRed = rag !== "Red" && hardStops.length > 0;
  if (ragForcedRed) {
    rag = "Red";
    reasons.unshift({
      severity: "critical",
      message: `Flagged Red on a hard rule — ${hardStops.join("; ")}.`,
    });
  }

  const order = { critical: 0, warning: 1 } as const;
  reasons.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score, rag, dimensions: dims, reasons, ragForcedRed };
}
