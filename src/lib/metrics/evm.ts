/**
 * Earned Value Management (EVM).
 *
 * Adapts to whatever the charter budget provides — hours, cost, or both:
 *  • % complete  = the project's progress (effort-weighted when tasks carry
 *    estimates, else task count).
 *  • planned %   = time elapsed against the charter start→end window (linear
 *    baseline; the chosen PV baseline).
 *  • Actual Cost = hours consumed from Timorc (for the hours unit) and, when a
 *    rate can be derived (cost budget ÷ hours budget), the same hours priced
 *    into the cost unit.
 *
 * SPI (= %complete ÷ planned%) is unit-independent and always available. CPI,
 * EAC, ETC and VAC need Actual Cost in that unit, so the cost unit only gets
 * them when a rate is available.
 */

import type { ProjectCharter } from "@/types/project";
import type { ProjectMetrics } from "./projectMetrics";

export interface EvmUnit {
  unit: "hours" | "cost";
  /** Currency label for the cost unit (e.g. "Rs"). */
  currency: string;
  bac: number; // Budget At Completion
  pv: number; // Planned Value
  ev: number; // Earned Value
  ac: number | null; // Actual Cost (null when not derivable)
  sv: number; // Schedule Variance = EV − PV
  cv: number | null; // Cost Variance = EV − AC
  spi: number | null; // Schedule Performance Index = EV / PV
  cpi: number | null; // Cost Performance Index = EV / AC
  eac: number | null; // Estimate At Completion = BAC / CPI
  etc: number | null; // Estimate To Complete = EAC − AC
  vac: number | null; // Variance At Completion = BAC − EAC
}

export interface EvmResult {
  available: boolean;
  percentComplete: number;
  plannedPercent: number;
  spi: number | null;
  /** Present units, hours first. */
  units: EvmUnit[];
  /** Optional caveat (e.g. cost EVM needs a rate). */
  note?: string;
}

function unit(
  kind: "hours" | "cost",
  currency: string,
  bac: number,
  pc: number,
  pp: number,
  ac: number | null,
): EvmUnit {
  const ev = (pc / 100) * bac;
  const pv = (pp / 100) * bac;
  const spi = pv > 0 ? ev / pv : null;
  const cpi = ac != null && ac > 0 ? ev / ac : null;
  const eac = cpi != null && cpi > 0 ? bac / cpi : null;
  return {
    unit: kind,
    currency,
    bac,
    pv,
    ev,
    ac,
    sv: ev - pv,
    cv: ac != null ? ev - ac : null,
    spi,
    cpi,
    eac,
    etc: eac != null && ac != null ? eac - ac : null,
    vac: eac != null ? bac - eac : null,
  };
}

export function computeEvm(charter: ProjectCharter, m: ProjectMetrics): EvmResult {
  const pc = m.overallProgressPct;
  const pp = m.timeElapsedPct ?? 0;
  const spi = pp > 0 ? pc / pp : null;

  const units: EvmUnit[] = [];
  let note: string | undefined;

  if (charter.budgetHours != null && charter.budgetHours > 0) {
    units.push(unit("hours", "", charter.budgetHours, pc, pp, m.consumedHours));
  }

  if (charter.budgetCost != null && charter.budgetCost > 0) {
    // Derive a rate from the hours budget so hours consumed can be priced.
    const rate =
      charter.budgetHours != null && charter.budgetHours > 0
        ? charter.budgetCost / charter.budgetHours
        : null;
    const acCost = rate != null ? m.consumedHours * rate : null;
    units.push(unit("cost", charter.currency || "", charter.budgetCost, pc, pp, acCost));
    if (rate == null) {
      note = "Cost CPI/EAC need an hourly rate — add an hours budget so cost can be priced from time logged.";
    }
  }

  return {
    available: units.length > 0,
    percentComplete: pc,
    plannedPercent: pp,
    spi,
    units,
    note,
  };
}
