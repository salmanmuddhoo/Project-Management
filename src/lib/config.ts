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
