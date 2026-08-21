/**
 * App-wide constants for the Planner + Timorc import model.
 *
 * Timorc logs time in man-days (0.25 = quarter day); the Charter budget is
 * expressed in hours ("50 hrs"). HOURS_PER_DAY converts between the two so
 * consumed-vs-budget is comparable.
 */
export const HOURS_PER_DAY = 7;

/** Governance / risk thresholds. */
export const OVER_BUDGET_WARN_PCT = 90; // consumed ≥ 90 % of budget → watch
export const BEHIND_SCHEDULE_GAP = 20; // elapsed% − progress% beyond this → risk

/** EVM index warning thresholds (SPI/CPI below 1 = behind/over). */
export const SPI_WARN = 0.9; // schedule perf. index below this → schedule reason
export const CPI_WARN = 0.9; // cost perf. index below this → budget reason

/**
 * Hard-stop rules — any one forces the overall RAG to Red regardless of the
 * weighted score. They mirror the three "significant" conditions executives
 * care about: past the end date, well over budget, or many overdue tasks.
 */
export const OVER_BUDGET_RED_PCT = 110; // consumed ≥ 110 % of budget → hard Red
export const OVERDUE_TASKS_RED = 5; // this many overdue tasks → hard Red

/**
 * Traffic-light (per-dimension RAG) thresholds for the Overview status lights.
 * These drive the discrete Schedule / Budget / Deliverables lights, which are
 * rule-based and explainable (see docs/METRICS.md §3.5), independent of the
 * weighted 0–100 health score.
 */
export const SCHEDULE_LATE_AMBER_DAYS = 5; // lateness ≥ 5 days → Schedule Amber
export const SCHEDULE_LATE_RED_DAYS = 10; // lateness ≥ 10 days → Schedule Red
export const BUDGET_BURN_AHEAD_AMBER_PCT = 25; // hours burned this far ahead of progress → Budget Amber
export const DELIVERY_BLOCKED_RED = 3; // this many blocked tasks → Deliverables Red

/**
 * Forecast tolerances — how far the projected finish (from EAC/VAC and SPI)
 * may drift from plan before it's flagged. A little slack avoids crying wolf
 * over rounding-level variances.
 */
export const FORECAST_BUDGET_TOLERANCE_PCT = 5; // EAC within ±5 % of BAC ⇒ "within budget"
export const FORECAST_SCHEDULE_TOLERANCE_PCT = 5; // finish within ±5 % of duration ⇒ "on time"
