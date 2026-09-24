/**
 * App-wide configuration: every tunable number or name the calculations use.
 *
 * `DEFAULT_SETTINGS` holds the values the app ships with. Users can override
 * any of them from the **Settings** menu; overrides are kept in the browser's
 * `localStorage` (see `src/store/settingsStore.ts`) and "Reset to defaults"
 * restores the values below.
 *
 * `SETTING_GROUPS` describes each field for the Settings page (label, help
 * text, bounds), so adding a setting is: add it to `AppSettings`, give it a
 * default here, describe it in a group, and read it where it is needed.
 */

export interface AppSettings {
  // -- Units -----------------------------------------------------------------
  /** 1 working day = N hours. Converts Timorc man-days and "N days" estimates/budgets to hours. */
  hoursPerDay: number;

  // -- Health score (weighted 0–100) ------------------------------------------
  weightSchedule: number;
  weightBudget: number;
  weightDelivery: number;
  /** Score at or above this ⇒ Green. */
  ragGreenMin: number;
  /** Score at or above this (and below Green) ⇒ Amber; below ⇒ Red. */
  ragAmberMin: number;
  /** Score used for a dimension that has no data. */
  neutralScore: number;

  // -- Risk reasons & hard-stop rules ----------------------------------------
  /** elapsed% − progress% beyond this ⇒ "behind schedule" warning. */
  behindScheduleGap: number;
  /** elapsed% − progress% beyond this ⇒ the warning becomes critical. */
  behindScheduleCriticalGap: number;
  /** SPI below this ⇒ schedule-performance warning. */
  spiWarn: number;
  /** CPI below this ⇒ cost-efficiency warning. */
  cpiWarn: number;
  /** SPI/CPI below this ⇒ the warning becomes critical. */
  indexCritical: number;
  /** Hours consumed ≥ this % of budget ⇒ "nearly exhausted" / Budget Amber. */
  overBudgetWarnPct: number;
  /** Hours consumed ≥ this % of budget ⇒ hard Red / Budget Red. */
  overBudgetRedPct: number;
  /** Hours burned this many points ahead of progress ⇒ warning / Budget Amber. */
  budgetBurnAheadPct: number;
  /** This many overdue tasks ⇒ the overdue-tasks reason becomes critical. */
  overdueTasksCritical: number;
  /** This many overdue tasks ⇒ hard Red / Deliverables Red. */
  overdueTasksRed: number;

  // -- Score formula (advanced) ----------------------------------------------
  scheduleLagFactor: number;
  scheduleOverduePenalty: number;
  budgetOverrunFactor: number;
  budgetBurnAheadFactor: number;
  deliveryBaseBonus: number;
  deliveryBlockedPenalty: number;
  deliveryOverduePenalty: number;

  // -- Overview traffic lights -----------------------------------------------
  scheduleLateAmberDays: number;
  scheduleLateRedDays: number;
  deliveryBlockedRed: number;

  // -- Forecast ----------------------------------------------------------------
  forecastBudgetTolerancePct: number;
  forecastScheduleTolerancePct: number;

  // -- Governance --------------------------------------------------------------
  /** Governance score below this ⇒ recommendation. */
  governanceStandard: number;

  // -- Kanban bucket classification (case-insensitive names) -------------------
  doneBuckets: string[];
  blockedBuckets: string[];
  progressBuckets: string[];

  // -- Planner import (applies to the next import) -----------------------------
  projectDetailsBucket: string;
  charterCardTitle: string;
  timorcCardTitle: string;
  resourcesCardTitle: string;
  defaultBucket: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  hoursPerDay: 7,

  // On-time delivery is the priority, so Schedule carries the most weight.
  weightSchedule: 0.4,
  weightBudget: 0.3,
  weightDelivery: 0.3,
  ragGreenMin: 80,
  ragAmberMin: 60,
  neutralScore: 75,

  behindScheduleGap: 20,
  behindScheduleCriticalGap: 40,
  spiWarn: 0.9,
  cpiWarn: 0.9,
  indexCritical: 0.75,
  overBudgetWarnPct: 90,
  overBudgetRedPct: 110,
  budgetBurnAheadPct: 25,
  overdueTasksCritical: 3,
  overdueTasksRed: 5,

  scheduleLagFactor: 1.5,
  scheduleOverduePenalty: 8,
  budgetOverrunFactor: 2.5,
  budgetBurnAheadFactor: 0.4,
  deliveryBaseBonus: 40,
  deliveryBlockedPenalty: 12,
  deliveryOverduePenalty: 6,

  scheduleLateAmberDays: 5,
  scheduleLateRedDays: 10,
  deliveryBlockedRed: 3,

  forecastBudgetTolerancePct: 5,
  forecastScheduleTolerancePct: 5,

  governanceStandard: 70,

  doneBuckets: ["completed", "done", "terminé", "terminée", "terminées", "termine", "closed", "clos"],
  blockedBuckets: ["blocked", "bloqué", "bloque", "on hold"],
  progressBuckets: ["in progress", "en cours", "doing", "wip"],

  projectDetailsBucket: "Project Details",
  charterCardTitle: "Project Charter",
  timorcCardTitle: "Taches Timorc",
  resourcesCardTitle: "Resources",
  defaultBucket: "Backlog",
};

// ---------------------------------------------------------------------------
// Field descriptions for the Settings page
// ---------------------------------------------------------------------------

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];
export type NumberSettingKey = KeysOfType<AppSettings, number>;
export type TextSettingKey = KeysOfType<AppSettings, string>;
export type ListSettingKey = KeysOfType<AppSettings, string[]>;

export type SettingField =
  | {
      kind: "number";
      key: NumberSettingKey;
      label: string;
      help: string;
      min: number;
      max?: number;
      step?: number;
      /** Unit shown after the input ("%", "days", "h"…). */
      unit?: string;
      /** Only integers are meaningful (counts, days). */
      integer?: boolean;
    }
  | { kind: "text"; key: TextSettingKey; label: string; help: string }
  | { kind: "list"; key: ListSettingKey; label: string; help: string };

export interface SettingGroup {
  id: string;
  title: string;
  description: string;
  /** Collapsed by default on the Settings page. */
  advanced?: boolean;
  fields: SettingField[];
}

export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: "units",
    title: "Units",
    description: "How working days convert to hours across time, estimates and budgets.",
    fields: [
      {
        kind: "number", key: "hoursPerDay", label: "Hours per working day", unit: "h", min: 0.5, max: 24, step: 0.5,
        help: "Converts Timorc man-days, task estimates written in days (\"3 days\") and day-based budgets to hours.",
      },
    ],
  },
  {
    id: "health",
    title: "Health score & RAG",
    description: "The weighted 0–100 health score and the bands that turn it into Green / Amber / Red.",
    fields: [
      { kind: "number", key: "weightSchedule", label: "Schedule weight", min: 0, max: 1, step: 0.05, help: "Share of the score from the Schedule dimension. Weights are normalised to sum to 1." },
      { kind: "number", key: "weightBudget", label: "Budget weight", min: 0, max: 1, step: 0.05, help: "Share of the score from the Budget (time) dimension." },
      { kind: "number", key: "weightDelivery", label: "Delivery weight", min: 0, max: 1, step: 0.05, help: "Share of the score from the Delivery dimension." },
      { kind: "number", key: "ragGreenMin", label: "Green from score", min: 0, max: 100, step: 1, integer: true, help: "A score at or above this is Green." },
      { kind: "number", key: "ragAmberMin", label: "Amber from score", min: 0, max: 100, step: 1, integer: true, help: "A score at or above this (but below Green) is Amber; lower is Red." },
      { kind: "number", key: "neutralScore", label: "Neutral score (no data)", min: 0, max: 100, step: 1, integer: true, help: "Score given to a dimension with no data (e.g. no dates or no budget)." },
    ],
  },
  {
    id: "risk",
    title: "Risk reasons & hard-stop rules",
    description: "When a risk reason is raised, when it is critical, and which conditions force the overall RAG to Red.",
    fields: [
      { kind: "number", key: "behindScheduleGap", label: "Behind schedule gap", unit: "pts", min: 0, max: 100, step: 1, help: "Warn when % time elapsed exceeds % progress by more than this." },
      { kind: "number", key: "behindScheduleCriticalGap", label: "Behind schedule — critical gap", unit: "pts", min: 0, max: 100, step: 1, help: "The behind-schedule reason becomes critical beyond this gap." },
      { kind: "number", key: "spiWarn", label: "SPI warning below", min: 0, max: 2, step: 0.05, help: "Schedule Performance Index below this raises a schedule warning." },
      { kind: "number", key: "cpiWarn", label: "CPI warning below", min: 0, max: 2, step: 0.05, help: "Cost Performance Index below this raises a cost-efficiency warning." },
      { kind: "number", key: "indexCritical", label: "SPI / CPI critical below", min: 0, max: 2, step: 0.05, help: "An SPI or CPI below this makes its warning critical." },
      { kind: "number", key: "overBudgetWarnPct", label: "Budget nearly exhausted at", unit: "%", min: 0, max: 1000, step: 1, help: "Hours consumed at or above this % of budget raises a warning and turns the Budget light Amber." },
      { kind: "number", key: "overBudgetRedPct", label: "Significantly over budget at", unit: "%", min: 0, max: 1000, step: 1, help: "Hours consumed at or above this % of budget forces the overall RAG and the Budget light to Red." },
      { kind: "number", key: "budgetBurnAheadPct", label: "Burn ahead of delivery", unit: "pts", min: 0, max: 100, step: 1, help: "Warn (and turn the Budget light Amber) when % budget used exceeds % progress by more than this." },
      { kind: "number", key: "overdueTasksCritical", label: "Overdue tasks — critical from", min: 1, step: 1, integer: true, help: "This many overdue tasks makes the overdue-tasks reason critical." },
      { kind: "number", key: "overdueTasksRed", label: "Overdue tasks — hard Red from", min: 1, step: 1, integer: true, help: "This many overdue tasks forces the overall RAG and the Deliverables light to Red." },
    ],
  },
  {
    id: "lights",
    title: "Overview traffic lights",
    description: "Thresholds for the discrete Schedule and Deliverables lights (Budget uses the risk thresholds above).",
    fields: [
      { kind: "number", key: "scheduleLateAmberDays", label: "Schedule Amber from", unit: "days late", min: 0, step: 1, integer: true, help: "Past the end date or behind pace by this many days ⇒ Amber." },
      { kind: "number", key: "scheduleLateRedDays", label: "Schedule Red from", unit: "days late", min: 0, step: 1, integer: true, help: "Past the end date or behind pace by this many days ⇒ Red." },
      { kind: "number", key: "deliveryBlockedRed", label: "Deliverables Red from", unit: "blocked tasks", min: 1, step: 1, integer: true, help: "This many blocked tasks turns the Deliverables light Red." },
    ],
  },
  {
    id: "forecast",
    title: "Forecast",
    description: "How much slack the forecast allows before flagging an overrun or a late finish.",
    fields: [
      { kind: "number", key: "forecastBudgetTolerancePct", label: "Budget tolerance", unit: "%", min: 0, max: 100, step: 1, help: "Estimate at completion within this % of budget counts as \"within budget\"." },
      { kind: "number", key: "forecastScheduleTolerancePct", label: "Schedule tolerance", unit: "%", min: 0, max: 100, step: 1, help: "Forecast finish within this % of the planned duration counts as \"on time\"." },
    ],
  },
  {
    id: "governance",
    title: "Governance",
    description: "The company standard for the governance checklist score.",
    fields: [
      { kind: "number", key: "governanceStandard", label: "Governance standard", min: 0, max: 100, step: 1, integer: true, help: "A governance score below this produces a recommendation." },
    ],
  },
  {
    id: "buckets",
    title: "Bucket classification",
    description: "Which Planner bucket names mean done, blocked or in progress. One name per line; case is ignored.",
    fields: [
      { kind: "list", key: "doneBuckets", label: "Done buckets", help: "Tasks in these buckets count as complete." },
      { kind: "list", key: "blockedBuckets", label: "Blocked buckets", help: "Tasks in these buckets count as blocked." },
      { kind: "list", key: "progressBuckets", label: "In-progress buckets", help: "Tasks in these buckets count as in progress." },
    ],
  },
  {
    id: "import",
    title: "Planner import",
    description: "Names of the special bucket and cards in a Planner board. Changes apply to the next import.",
    fields: [
      { kind: "text", key: "projectDetailsBucket", label: "Project details bucket", help: "The bucket holding the charter cards; it is not shown as a Kanban column." },
      { kind: "text", key: "charterCardTitle", label: "Charter card title", help: "Card whose notes hold the project charter." },
      { kind: "text", key: "timorcCardTitle", label: "Timorc codes card title", help: "Legacy card listing the Timorc codes." },
      { kind: "text", key: "resourcesCardTitle", label: "Resources card title", help: "Legacy card listing the team." },
      { kind: "text", key: "defaultBucket", label: "Default bucket", help: "Bucket used for tasks exported without one." },
    ],
  },
  {
    id: "formula",
    title: "Score formula (advanced)",
    description: "Coefficients inside the health-score dimensions. See docs/METRICS.md for the exact formulas.",
    advanced: true,
    fields: [
      { kind: "number", key: "scheduleLagFactor", label: "Schedule: points lost per point of lag", min: 0, step: 0.1, help: "Schedule base = 100 − lag × this." },
      { kind: "number", key: "scheduleOverduePenalty", label: "Schedule: penalty per overdue task", min: 0, step: 1, help: "Points removed from Schedule for each overdue task." },
      { kind: "number", key: "budgetOverrunFactor", label: "Budget: points lost per % over", min: 0, step: 0.1, help: "Budget base = 100 − (% over budget) × this." },
      { kind: "number", key: "budgetBurnAheadFactor", label: "Budget: points lost per point burned ahead", min: 0, step: 0.1, help: "Points removed per point that % budget used exceeds % progress." },
      { kind: "number", key: "deliveryBaseBonus", label: "Delivery: base bonus", min: 0, max: 100, step: 1, help: "Delivery = progress + this − penalties." },
      { kind: "number", key: "deliveryBlockedPenalty", label: "Delivery: penalty per blocked task", min: 0, step: 1, help: "Points removed from Delivery for each blocked task." },
      { kind: "number", key: "deliveryOverduePenalty", label: "Delivery: penalty per overdue task", min: 0, step: 1, help: "Points removed from Delivery for each overdue task." },
    ],
  },
];

/** Cross-field sanity checks, shown as warnings on the Settings page. */
export function settingsWarnings(s: AppSettings): string[] {
  const w: string[] = [];
  if (s.weightSchedule + s.weightBudget + s.weightDelivery <= 0) w.push("All health weights are 0 — the neutral score will be used.");
  if (s.ragAmberMin > s.ragGreenMin) w.push("Amber starts above Green — no score can be Amber.");
  if (s.behindScheduleCriticalGap < s.behindScheduleGap) w.push("Behind-schedule critical gap is below the warning gap.");
  if (s.indexCritical > Math.min(s.spiWarn, s.cpiWarn)) w.push("SPI/CPI critical threshold is above a warning threshold.");
  if (s.overBudgetRedPct < s.overBudgetWarnPct) w.push("Over-budget Red is below the nearly-exhausted warning.");
  if (s.overdueTasksRed < s.overdueTasksCritical) w.push("Overdue tasks hard Red is below the critical threshold.");
  if (s.scheduleLateRedDays < s.scheduleLateAmberDays) w.push("Schedule Red starts before Schedule Amber.");
  return w;
}
