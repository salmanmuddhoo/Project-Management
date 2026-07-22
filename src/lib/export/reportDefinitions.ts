/**
 * Report definitions shared by the Excel and PDF renderers. Each report
 * builds simple tables from the computed snapshots — the renderers only
 * decide how a table looks, never what is in it, so both formats agree.
 */

import { computePortfolioMetrics, type ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { generateRecommendations } from "@/lib/metrics/recommendations";
import { formatDate, formatNumber, formatPct } from "@/lib/utils";

export interface ReportTable {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  build: (snapshots: ProjectSnapshot[]) => ReportTable[];
}

const hrs = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}h`);
const projectRows = (
  snapshots: ProjectSnapshot[],
  mapper: (s: ProjectSnapshot) => Array<string | number>,
) => snapshots.map(mapper);

export const REPORTS: ReportDefinition[] = [
  {
    key: "executive",
    title: "Executive Portfolio Report",
    description: "Portfolio KPIs, per-project summary and top recommendations.",
    build: (snapshots) => {
      const p = computePortfolioMetrics(snapshots);
      return [
        {
          title: "Portfolio KPIs",
          headers: ["KPI", "Value"],
          rows: [
            ["Total Projects", p.totalProjects],
            ["On Track (green)", p.onTrack],
            ["At Risk (red)", p.atRisk],
            ["Over Budget", p.overBudget],
            ["Completed", p.completed],
            ["Total Hours Budget", hrs(p.totalBudgetHours)],
            ["Hours Consumed", hrs(p.consumedHours)],
            ["Hours Remaining", hrs(p.remainingHours)],
            ["Tasks Completed", `${p.tasksCompleted}/${p.tasksTotal}`],
            ["Portfolio Health", `${p.portfolioHealthScore} (${p.portfolioRag})`],
          ],
        },
        {
          title: "Projects",
          headers: ["Project", "Manager", "Progress", "Health", "Budget", "Consumed", "Consumed %", "Days Left", "Overdue Tasks"],
          rows: projectRows(snapshots, (s) => [
            s.project.charter.projectName,
            s.project.charter.manager || "—",
            formatPct(s.metrics.taskCompletionPct),
            `${s.health.score} (${s.health.rag})`,
            hrs(s.metrics.budgetHours),
            hrs(s.metrics.consumedHours),
            formatPct(s.metrics.budgetConsumedPct),
            s.metrics.daysRemaining ?? "—",
            s.metrics.tasksOverdue,
          ]),
        },
        {
          title: "Recommendations",
          headers: ["Severity", "Category", "Recommendation"],
          rows: generateRecommendations(snapshots).map((r) => [r.severity.toUpperCase(), r.category, r.message]),
        },
      ];
    },
  },
  {
    key: "status",
    title: "Project Status Report",
    description: "Schedule, progress and forecast per project.",
    build: (snapshots) => [
      {
        title: "Project Status",
        headers: ["Project", "Code", "Manager", "Start", "End", "Elapsed %", "Progress %", "Days Left", "Health", "Risk reasons"],
        rows: projectRows(snapshots, (s) => [
          s.project.charter.projectName,
          s.project.charter.projectCode,
          s.project.charter.manager || "—",
          formatDate(s.project.charter.startDate),
          formatDate(s.project.charter.endDate),
          formatPct(s.metrics.timeElapsedPct),
          formatPct(s.metrics.taskCompletionPct),
          s.metrics.daysRemaining ?? "—",
          `${s.health.score} (${s.health.rag})`,
          s.health.reasons.map((r) => r.message).join(" | ") || "None",
        ]),
      },
    ],
  },
  {
    key: "time",
    title: "Time & Budget Report",
    description: "Hours consumed vs budget, by project and by person.",
    build: (snapshots) => [
      {
        title: "Budget vs Consumed (hours)",
        headers: ["Project", "Timorc code(s)", "Budget", "Consumed", "Remaining", "Consumed %", "Over budget"],
        rows: projectRows(snapshots, (s) => [
          s.project.charter.projectName,
          s.project.timorcCodes.map((c) => c.code).join(", ") || "—",
          hrs(s.metrics.budgetHours),
          hrs(s.metrics.consumedHours),
          hrs(s.metrics.remainingHours),
          formatPct(s.metrics.budgetConsumedPct),
          s.metrics.overBudget ? "YES" : "",
        ]),
      },
      {
        title: "Hours by Person",
        headers: ["Project", "Person", "Days", "Hours"],
        rows: snapshots.flatMap((s) =>
          s.metrics.byResource.map((r) => [s.project.charter.projectName, r.name, formatNumber(r.days), hrs(r.hours)]),
        ),
      },
    ],
  },
  {
    key: "evm",
    title: "EVM Report",
    description: "Earned Value Management metrics per project and unit.",
    build: (snapshots) => [
      {
        title: "Earned Value Management",
        headers: ["Project", "Unit", "% Complete", "% Planned", "BAC", "PV", "EV", "AC", "SPI", "CPI", "EAC", "VAC"],
        rows: snapshots.flatMap((s) =>
          s.evm.units.map((u) => {
            const fmt = (v: number | null) => (v == null ? "—" : u.unit === "hours" ? `${Math.round(v)}h` : Math.round(v).toLocaleString());
            return [
              s.project.charter.projectName,
              u.unit === "cost" && u.currency ? `Cost (${u.currency})` : u.unit,
              `${Math.round(s.evm.percentComplete)}%`,
              `${Math.round(s.evm.plannedPercent)}%`,
              fmt(u.bac), fmt(u.pv), fmt(u.ev), fmt(u.ac),
              u.spi == null ? "—" : u.spi.toFixed(2),
              u.cpi == null ? "—" : u.cpi.toFixed(2),
              fmt(u.eac), fmt(u.vac),
            ];
          }),
        ),
      },
    ],
  },
  {
    key: "tasks",
    title: "Task Report",
    description: "Board tasks across all projects.",
    build: (snapshots) => [
      {
        title: "Tasks",
        headers: ["Project", "Task", "Bucket", "Assignee", "Priority", "Start", "Due", "End", "Overdue"],
        rows: snapshots.flatMap((s) =>
          s.project.tasks.map((t) => [
            s.project.charter.projectName, t.title, t.bucket, t.assignee || "—", t.priority,
            formatDate(t.startDate), formatDate(t.dueDate), formatDate(t.endDate), t.overdue ? "YES" : "",
          ]),
        ),
      },
    ],
  },
  {
    key: "risk",
    title: "Risk Report",
    description: "Computed risk reasons per project.",
    build: (snapshots) => [
      {
        title: "Risks",
        headers: ["Project", "Health", "Severity", "Risk"],
        rows: snapshots.flatMap((s) =>
          s.health.reasons.length > 0
            ? s.health.reasons.map((r) => [s.project.charter.projectName, `${s.health.score} (${s.health.rag})`, r.severity.toUpperCase(), r.message])
            : [[s.project.charter.projectName, `${s.health.score} (${s.health.rag})`, "—", "No risks flagged"]],
        ),
      },
    ],
  },
  {
    key: "governance",
    title: "Governance Report",
    description: "Governance compliance per project.",
    build: (snapshots) => [
      {
        title: "Governance Scores",
        headers: ["Project", "Score", "Failed Checks"],
        rows: projectRows(snapshots, (s) => [
          s.project.charter.projectName, s.governance.score, s.governance.failedChecks.join("; ") || "None",
        ]),
      },
      {
        title: "Check Detail",
        headers: ["Project", "Check", "Result"],
        rows: snapshots.flatMap((s) =>
          s.governance.checks.map((c) => [s.project.charter.projectName, c.label, c.passed ? "PASS" : "FAIL"]),
        ),
      },
    ],
  },
];
