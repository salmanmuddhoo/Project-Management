/**
 * Project health & risk model, adapted to the Planner + Timorc data.
 *
 * Three weighted dimensions (Schedule, Budget/time, Delivery) produce a 0–100
 * score and a RAG. Alongside the score we surface concrete risk reasons — the
 * "why" an executive needs. Dimensions with no data score a neutral value.
 *
 * Every threshold, weight and coefficient comes from the user Settings
 * (defaults in `src/lib/config.ts`).
 *
 * Where EVM is available we blend in the standard indices: SPI into the
 * Schedule dimension and CPI into the Budget dimension. Finally, a set of
 * hard-stop rules can force the overall RAG to Red regardless of the weighted
 * score (past the end date, well over budget, or many overdue tasks).
 */

import type { RagStatus } from "@/types/project";
import type { AppSettings } from "@/lib/config";
import { clamp } from "@/lib/utils";
import { getSettings } from "@/store/settingsStore";
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

/**
 * Dimension weights from Settings, normalised to sum to 1 (the defaults
 * 0.4 / 0.3 / 0.3 already do). All-zero weights fall back to equal thirds.
 */
export function healthWeights(s: AppSettings = getSettings()) {
  const total = s.weightSchedule + s.weightBudget + s.weightDelivery;
  if (!(total > 0)) return { schedule: 1 / 3, budget: 1 / 3, delivery: 1 / 3 };
  return {
    schedule: s.weightSchedule / total,
    budget: s.weightBudget / total,
    delivery: s.weightDelivery / total,
  };
}

/** Map an EVM index (SPI/CPI, 1 = on plan) to a 0–100 dimension score. */
function indexScore(index: number): number {
  return clamp(index * 100, 0, 100);
}

export function ragOf(score: number, s: AppSettings = getSettings()): RagStatus {
  if (score >= s.ragGreenMin) return "Green";
  if (score >= s.ragAmberMin) return "Amber";
  return "Red";
}

export function computeHealthScore(
  m: ProjectMetrics,
  evm?: EvmResult,
  s: AppSettings = getSettings(),
): HealthScore {
  const weights = healthWeights(s);
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
      let base = clamp(100 - lag * s.scheduleLagFactor, 0, 100);
      // Blend in SPI (a standard EVM schedule measure) when we have it.
      if (spi != null) base = (base + indexScore(spi)) / 2;
      score = clamp(base - m.tasksOverdue * s.scheduleOverduePenalty, 0, 100);
      detail =
        m.daysRemaining != null && m.daysRemaining < 0
          ? `${Math.abs(m.daysRemaining)} day(s) past end date`
          : `${Math.round(m.timeElapsedPct)}% elapsed, ${Math.round(m.overallProgressPct)}% done${spi != null ? ` · SPI ${spi.toFixed(2)}` : ""}`;
      if (lag > s.behindScheduleGap) {
        reasons.push({
          severity: lag > s.behindScheduleCriticalGap ? "critical" : "warning",
          message: `Behind schedule — ${Math.round(m.timeElapsedPct)}% of time elapsed but only ${Math.round(m.overallProgressPct)}% of tasks done.`,
        });
      }
      if (spi != null && spi < s.spiWarn) {
        reasons.push({
          severity: spi < s.indexCritical ? "critical" : "warning",
          message: `Schedule performance behind plan — SPI ${spi.toFixed(2)} (earned vs planned value).`,
        });
      }
      if (m.overdue) reasons.push({ severity: "critical", message: "Past its end date and not complete." });
      if (m.tasksOverdue > 0) {
        reasons.push({
          severity: m.tasksOverdue >= s.overdueTasksCritical ? "critical" : "warning",
          message: `${m.tasksOverdue} overdue task(s).`,
        });
      }
    }
    dims.push({ key: "schedule", label: "Schedule", weight: weights.schedule, score, detail });
  }

  // -- Budget (time) --------------------------------------------------------
  {
    let score: number | null = null;
    let detail = "No hours budget / time logged";
    if (m.budgetConsumedPct != null) {
      const overPct = Math.max(0, m.budgetConsumedPct - 100);
      let base = clamp(100 - overPct * s.budgetOverrunFactor, 0, 100);
      // Burn running ahead of delivery is also a risk.
      const burnAhead = Math.max(0, m.budgetConsumedPct - m.overallProgressPct);
      base = clamp(base - burnAhead * s.budgetBurnAheadFactor, 0, 100);
      // Blend in CPI (a standard EVM budget-efficiency measure) when we have it.
      score = cpi != null ? (base + indexScore(cpi)) / 2 : base;
      detail = `${Math.round(m.consumedHours)}h of ${Math.round(m.budgetHours ?? 0)}h used (${Math.round(m.budgetConsumedPct)}%)${cpi != null ? ` · CPI ${cpi.toFixed(2)}` : ""}`;
      if (m.overBudget) {
        reasons.push({
          severity: "critical",
          message: `Over budget — ${Math.round(m.consumedHours)}h used against a ${Math.round(m.budgetHours ?? 0)}h budget.`,
        });
      } else if (m.budgetConsumedPct >= s.overBudgetWarnPct) {
        reasons.push({
          severity: "warning",
          message: `Budget nearly exhausted — ${Math.round(m.budgetConsumedPct)}% of hours used.`,
        });
      }
      if (cpi != null && cpi < s.cpiWarn && !m.overBudget) {
        reasons.push({
          severity: cpi < s.indexCritical ? "critical" : "warning",
          message: `Cost efficiency below plan — CPI ${cpi.toFixed(2)} (earned value per hour spent).`,
        });
      }
      if (burnAhead > s.budgetBurnAheadPct && !m.overBudget) {
        reasons.push({
          severity: "warning",
          message: `Hours are burning faster than delivery (${Math.round(m.budgetConsumedPct)}% budget vs ${Math.round(m.overallProgressPct)}% done).`,
        });
      }
    } else if (m.budgetHours != null && m.timeEntryCount === 0) {
      reasons.push({ severity: "warning", message: "No time logged yet against this project's Timorc code." });
    }
    dims.push({ key: "budget", label: "Budget (time)", weight: weights.budget, score, detail });
  }

  // -- Delivery -------------------------------------------------------------
  {
    let score: number | null = null;
    let detail = "No tasks";
    if (m.tasksTotal > 0) {
      score = clamp(
        m.overallProgressPct +
          s.deliveryBaseBonus -
          m.tasksBlocked * s.deliveryBlockedPenalty -
          m.tasksOverdue * s.deliveryOverduePenalty,
        0,
        100,
      );
      detail = `${m.tasksCompleted}/${m.tasksTotal} done · ${m.tasksInProgress} in progress · ${m.tasksBlocked} blocked`;
      if (m.tasksBlocked > 0) {
        reasons.push({
          severity: "warning",
          message: `${m.tasksBlocked} blocked task(s).`,
        });
      }
    }
    dims.push({ key: "delivery", label: "Delivery", weight: weights.delivery, score, detail });
  }

  const total = dims.reduce((sum, d) => sum + (d.score ?? s.neutralScore) * d.weight, 0);
  const score = Math.round(clamp(total, 0, 100));

  // -- Hard-stop rules: force Red for the conditions executives can't ignore.
  let rag = ragOf(score, s);
  const hardStops: string[] = [];
  if (m.overdue) hardStops.push("past its end date and not complete");
  if (m.budgetConsumedPct != null && m.budgetConsumedPct >= s.overBudgetRedPct) {
    hardStops.push(`significantly over budget (${Math.round(m.budgetConsumedPct)}% of hours used)`);
  }
  if (m.tasksOverdue >= s.overdueTasksRed) {
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
