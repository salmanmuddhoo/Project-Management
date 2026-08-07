/**
 * Forecast risk — answers the executive question:
 *   "On current performance, will the project finish within budget and within
 *    the planned timeline?"
 *
 * Budget is forecast from EVM's EAC/VAC (Estimate / Variance At Completion) in
 * the primary unit (hours, or cost when priced). Timeline is forecast from SPI:
 * the independent estimate of duration at completion is planned duration ÷ SPI,
 * giving a projected finish date to compare against the charter end date.
 *
 * Everything derives from already-computed EVM + metrics; nothing is stored.
 */

import { FORECAST_BUDGET_TOLERANCE_PCT, FORECAST_SCHEDULE_TOLERANCE_PCT } from "@/lib/config";
import { addDays, daysBetween } from "@/lib/utils";
import type { EvmResult } from "./evm";
import type { ProjectMetrics } from "./projectMetrics";

export type ForecastOutlook = "within" | "over" | "unknown";

export interface BudgetForecast {
  unit: "hours" | "cost";
  currency: string;
  bac: number;
  eac: number | null;
  vac: number | null; // BAC − EAC (negative ⇒ overrun)
  /** (EAC − BAC) ÷ BAC × 100; positive ⇒ over. */
  overrunPct: number | null;
  outlook: ForecastOutlook;
}

export interface ScheduleForecast {
  spi: number | null;
  plannedEnd: Date | null;
  forecastEnd: Date | null;
  /** Forecast finish − planned end, in days; positive ⇒ late. */
  daysVariance: number | null;
  outlook: ForecastOutlook; // "within" = on time, "over" = late
}

export interface ForecastResult {
  available: boolean;
  budget: BudgetForecast | null;
  schedule: ScheduleForecast | null;
  /** Overall: on_track (both ok) · at_risk (one) · off_track (both) · unknown. */
  verdict: "on_track" | "at_risk" | "off_track" | "unknown";
  /** One-line, plain-language answer for the dashboard. */
  summary: string;
}

export function computeForecast(evm: EvmResult, m: ProjectMetrics): ForecastResult {
  // -- Budget forecast (primary EVM unit: hours first, else cost) ------------
  let budget: BudgetForecast | null = null;
  const u = evm.units[0];
  if (u) {
    const overrunPct = u.eac != null && u.bac > 0 ? ((u.eac - u.bac) / u.bac) * 100 : null;
    const outlook: ForecastOutlook =
      overrunPct == null ? "unknown" : overrunPct > FORECAST_BUDGET_TOLERANCE_PCT ? "over" : "within";
    budget = { unit: u.unit, currency: u.currency, bac: u.bac, eac: u.eac, vac: u.vac, overrunPct, outlook };
  }

  // -- Schedule forecast (duration ÷ SPI ⇒ projected finish) ----------------
  let schedule: ScheduleForecast | null = null;
  if (m.startDate != null && m.durationDays != null && m.durationDays > 0) {
    const spi = evm.spi;
    const forecastDuration = spi != null && spi > 0 ? m.durationDays / spi : null;
    const forecastEnd = forecastDuration != null ? addDays(m.startDate, forecastDuration) : null;
    const daysVariance =
      forecastEnd != null && m.endDate != null ? daysBetween(m.endDate, forecastEnd) : null;
    const tolDays = (FORECAST_SCHEDULE_TOLERANCE_PCT / 100) * m.durationDays;
    const outlook: ForecastOutlook =
      daysVariance == null ? "unknown" : daysVariance > tolDays ? "over" : "within";
    schedule = { spi, plannedEnd: m.endDate, forecastEnd, daysVariance, outlook };
  }

  // -- Overall verdict ------------------------------------------------------
  const outlooks = [budget?.outlook, schedule?.outlook].filter(
    (o): o is ForecastOutlook => o != null && o !== "unknown",
  );
  let verdict: ForecastResult["verdict"];
  if (outlooks.length === 0) verdict = "unknown";
  else {
    const overs = outlooks.filter((o) => o === "over").length;
    verdict = overs === 0 ? "on_track" : overs === outlooks.length ? "off_track" : "at_risk";
  }

  return {
    available: budget != null || schedule != null,
    budget,
    schedule,
    verdict,
    summary: buildSummary(budget, schedule),
  };
}

function budgetPhrase(b: BudgetForecast): string {
  if (b.outlook === "unknown" || b.overrunPct == null) return "budget outlook unknown (no time logged yet)";
  const mag = Math.abs(Math.round(b.overrunPct));
  if (b.outlook === "over") return `over budget by ~${mag}%`;
  return mag <= 1 ? "on budget" : `within budget (~${mag}% to spare)`;
}

function schedulePhrase(s: ScheduleForecast): string {
  if (s.outlook === "unknown" || s.daysVariance == null) return "timeline outlook unknown";
  const d = Math.abs(s.daysVariance);
  if (s.daysVariance > 0) return `finishing ~${d} day(s) late`;
  return d <= 1 ? "finishing on time" : `finishing ~${d} day(s) early`;
}

function buildSummary(budget: BudgetForecast | null, schedule: ScheduleForecast | null): string {
  const parts: string[] = [];
  if (schedule) parts.push(schedulePhrase(schedule));
  if (budget) parts.push(budgetPhrase(budget));
  if (parts.length === 0) return "Not enough data to forecast — add a budget and charter dates.";
  return `On current performance: ${parts.join(" · ")}.`;
}
