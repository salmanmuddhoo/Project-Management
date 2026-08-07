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
