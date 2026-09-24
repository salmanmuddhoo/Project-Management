/**
 * Burndown — remaining work (and remaining hours budget) over the charter
 * window, actual vs expected.
 *
 *  • Expected: the ideal straight line from the full scope on the charter
 *    start date to zero on the charter end date.
 *  • Actual (work): scope minus the tasks completed by each day. A task counts
 *    on its Planner completion date; a task that is done but has no
 *    completion date (e.g. moved to a done bucket) counts from today. Work is
 *    measured in estimated hours when tasks carry estimates, else in tasks —
 *    the same basis as the Progress KPI. Partial progress is not burned until
 *    the task is complete (standard burndown convention).
 *  • Actual (budget): hours budget minus the Timorc hours logged up to each
 *    day. Entries without a date count from the start. It can go below zero
 *    when the project is over budget.
 *
 * The actual line stops at today; the expected line runs to the end date. If
 * the project is past its end date the window extends to today.
 */

import type { AppSettings } from "@/lib/config";
import type { Project } from "@/types/project";
import type { TimeEntry } from "@/types/time";
import { getSettings } from "@/store/settingsStore";
import { isTaskDone, type ProjectMetrics } from "./projectMetrics";

const DAY_MS = 86_400_000;
/** Most points drawn per series; longer projects are sampled every N days. */
const MAX_POINTS = 180;

export interface BurndownPoint {
  /** Day timestamp (UTC midnight, ms) — numeric x value. */
  date: number;
  expected: number | null;
  actual: number | null;
}

export interface BurndownSeries {
  kind: "work" | "budget";
  /** Unit of the y values. */
  unit: "hours" | "tasks";
  available: boolean;
  /** Why the series is unavailable (shown instead of the chart). */
  unavailableReason?: string;
  /** Scope at the start (total work or hours budget). */
  total: number;
  points: BurndownPoint[];
  startDate: number | null;
  endDate: number | null;
  /** Today's day timestamp, when it falls inside the chart window. */
  today: number | null;
  actualToday: number | null;
  expectedToday: number | null;
  /**
   * actual − expected remaining, today. Work: positive ⇒ behind plan.
   * Budget: negative ⇒ hours burning faster than planned.
   */
  varianceToday: number | null;
}

export interface BurndownResult {
  work: BurndownSeries;
  budget: BurndownSeries;
}

const dayOf = (d: Date) => Math.floor(d.getTime() / DAY_MS);

function unavailable(kind: BurndownSeries["kind"], unit: BurndownSeries["unit"], reason: string): BurndownSeries {
  return {
    kind, unit, available: false, unavailableReason: reason, total: 0, points: [],
    startDate: null, endDate: null, today: null, actualToday: null, expectedToday: null, varianceToday: null,
  };
}

/** Days to plot: every `step` days from start to the last day, plus key days. */
function sampleDays(startDay: number, endDay: number, todayDay: number): number[] {
  const lastDay = Math.max(endDay, todayDay >= startDay ? todayDay : endDay);
  const step = Math.max(1, Math.ceil((lastDay - startDay) / MAX_POINTS));
  const days = new Set<number>([startDay, endDay, lastDay]);
  for (let d = startDay; d <= lastDay; d += step) days.add(d);
  if (todayDay >= startDay && todayDay <= lastDay) days.add(todayDay);
  return [...days].sort((a, b) => a - b);
}

/**
 * Build one series from a scope, the charter window and a function giving the
 * amount burned by the end of a given day.
 */
function buildSeries(
  kind: BurndownSeries["kind"],
  unit: BurndownSeries["unit"],
  total: number,
  startDay: number,
  endDay: number,
  todayDay: number,
  burnedBy: (day: number) => number,
): BurndownSeries {
  const span = Math.max(1, endDay - startDay);
  const expectedAt = (day: number) => total * (1 - Math.min(1, Math.max(0, (day - startDay) / span)));
  const actualAt = (day: number) => total - burnedBy(day);

  const points: BurndownPoint[] = sampleDays(startDay, endDay, todayDay).map((day) => ({
    date: day * DAY_MS,
    expected: day <= endDay ? expectedAt(day) : 0,
    actual: day <= todayDay ? actualAt(day) : null,
  }));

  const started = todayDay >= startDay;
  const actualToday = started ? actualAt(todayDay) : null;
  const expectedToday = started ? expectedAt(todayDay) : null;
  return {
    kind,
    unit,
    available: true,
    total,
    points,
    startDate: startDay * DAY_MS,
    endDate: endDay * DAY_MS,
    today: started ? todayDay * DAY_MS : null,
    actualToday,
    expectedToday,
    varianceToday: actualToday != null && expectedToday != null ? actualToday - expectedToday : null,
  };
}

export function computeBurndown(
  project: Project,
  metrics: ProjectMetrics,
  entries: TimeEntry[],
  today: Date = new Date(),
  settings: AppSettings = getSettings(),
): BurndownResult {
  const { startDate, endDate } = project.charter;
  const byEstimate = metrics.estimateHoursTotal > 0;
  const workUnit = byEstimate ? "hours" : "tasks";

  if (!startDate || !endDate || endDate <= startDate) {
    const reason = "Add a start and end date to the charter to plot a burndown.";
    return { work: unavailable("work", workUnit, reason), budget: unavailable("budget", "hours", reason) };
  }

  const startDay = dayOf(startDate);
  const endDay = dayOf(endDate);
  const todayDay = dayOf(today);

  // -- Work ------------------------------------------------------------------
  let work: BurndownSeries;
  if (project.tasks.length === 0) {
    work = unavailable("work", workUnit, "No work tasks on the board yet.");
  } else {
    const weightOf = (t: Project["tasks"][number]) => (byEstimate ? (t.estimateHours ?? 0) : 1);
    const total = project.tasks.reduce((s, t) => s + weightOf(t), 0);
    // Day each completed task burned; done-without-date ⇒ today.
    const completions = project.tasks
      .filter((t) => isTaskDone(t, settings))
      .map((t) => ({ day: t.endDate ? dayOf(t.endDate) : todayDay, weight: weightOf(t) }));
    work = buildSeries("work", workUnit, total, startDay, endDay, todayDay, (day) =>
      completions.reduce((s, c) => (c.day <= day ? s + c.weight : s), 0),
    );
  }

  // -- Budget (hours) ----------------------------------------------------------
  let budget: BurndownSeries;
  const budgetHours = metrics.budgetHours;
  if (budgetHours == null || budgetHours <= 0) {
    budget = unavailable("budget", "hours", "No hours budget on the charter.");
  } else {
    const logged = entries.map((e) => ({
      day: e.date ? dayOf(e.date) : startDay,
      hours: (e.days ?? 0) * settings.hoursPerDay,
    }));
    budget = buildSeries("budget", "hours", budgetHours, startDay, endDay, todayDay, (day) =>
      logged.reduce((s, l) => (l.day <= day ? s + l.hours : s), 0),
    );
  }

  return { work, budget };
}

// ---------------------------------------------------------------------------
// Presentation helpers shared by the Overview chart and the PDF report
// ---------------------------------------------------------------------------

const utcDateFmt = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/** "12h" / "3 tasks" for a burndown value. */
export function formatBurndownValue(series: BurndownSeries, v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (series.unit === "hours") {
    const r = Math.round(v * 10) / 10;
    return `${Number.isInteger(r) ? r : r.toFixed(1)}h`;
  }
  const n = Math.round(v * 10) / 10;
  return `${n} task${n === 1 ? "" : "s"}`;
}

/** Format a burndown day timestamp (UTC midnight) as a date. */
export function formatBurndownDate(ms: number): string {
  return utcDateFmt.format(ms);
}

export interface BurndownVerdict {
  /** bad = behind plan / burning fast; good = ahead / under burn. */
  tone: "bad" | "good" | "on-plan" | "not-started";
  /** Short status label ("Behind plan", "On plan"…). */
  label: string;
  /** One sentence with today's numbers. */
  summary: string;
}

/**
 * Today's verdict for a series. Tolerance before flagging = the forecast
 * tolerance % (schedule for work, budget for hours) of the scope.
 */
export function burndownVerdict(series: BurndownSeries, s: AppSettings = getSettings()): BurndownVerdict {
  if (series.today == null || series.varianceToday == null) {
    return {
      tone: "not-started",
      label: "Not started",
      summary: `The plan begins ${series.startDate != null ? formatBurndownDate(series.startDate) : "—"}.`,
    };
  }
  const tolPct = series.kind === "work" ? s.forecastScheduleTolerancePct : s.forecastBudgetTolerancePct;
  const tolerance = (tolPct / 100) * series.total;
  const v = series.varianceToday;
  // Work: more remaining than planned ⇒ behind. Budget: less left than planned ⇒ burning fast.
  const bad = series.kind === "work" ? v > tolerance : v < -tolerance;
  const good = series.kind === "work" ? v < -tolerance : v > tolerance;
  const gap = formatBurndownValue(series, Math.abs(v));
  const fmt = (x: number | null) => formatBurndownValue(series, x);

  const now =
    series.kind === "budget" && (series.actualToday ?? 0) < 0
      ? `${fmt(Math.abs(series.actualToday ?? 0))} over budget today`
      : `${fmt(series.actualToday)} left today`;
  const head = `${now} vs ${fmt(series.expectedToday)} expected`;

  if (bad) {
    return {
      tone: "bad",
      label: series.kind === "work" ? "Behind plan" : "Burning fast",
      summary: `${head} — ${gap} ${series.kind === "work" ? "more work left than planned for today" : "less budget left than an even burn"}.`,
    };
  }
  if (good) {
    return {
      tone: "good",
      label: series.kind === "work" ? "Ahead of plan" : "Under burn",
      summary: `${head} — ${gap} ${series.kind === "work" ? "less work left than planned for today" : "more budget left than an even burn"}.`,
    };
  }
  return { tone: "on-plan", label: "On plan", summary: `${head} — within tolerance of the plan.` };
}
