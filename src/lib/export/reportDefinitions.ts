/**
 * Report definitions shared by the Excel and PDF renderers.
 *
 * Each report builds one or more simple tables from the computed snapshots —
 * the renderers only decide how a table looks on paper/in a workbook, never
 * what is in it, so both formats always agree.
 */

import {
  computeCapacity,
  computePortfolioMetrics,
  type ProjectSnapshot,
} from "@/lib/metrics/portfolioMetrics";
import { generateRecommendations } from "@/lib/metrics/recommendations";
import { formatDate, formatMoney, formatPct } from "@/lib/utils";

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

const num = (v: number | null | undefined) => (v == null ? "—" : Math.round(v));

function projectRows(
  snapshots: ProjectSnapshot[],
  mapper: (s: ProjectSnapshot) => Array<string | number>,
): Array<Array<string | number>> {
  return snapshots.map(mapper);
}

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
            ["Projects On Track", p.onTrack],
            ["Projects Delayed", p.delayed],
            ["Projects At Risk", p.atRisk],
            ["Completed Projects", p.completed],
            ["Total Budget", formatMoney(p.totalBudget)],
            ["Budget Used", formatMoney(p.budgetUsed)],
            ["Remaining Budget", formatMoney(p.budgetRemaining)],
            ["Total Planned Hours", num(p.totalPlannedHours)],
            ["Total Logged Hours", num(p.totalLoggedHours)],
            ["Remaining Hours", num(p.remainingHours)],
            ["Portfolio Health", `${p.portfolioHealthScore} (${p.portfolioRag})`],
          ],
        },
        {
          title: "Projects",
          headers: ["Project", "PM", "Status", "Phase", "Progress", "Health", "Budget", "Variance %", "Days Delayed"],
          rows: projectRows(snapshots, (s) => [
            s.project.charter.projectName,
            s.project.charter.projectManager,
            s.project.charter.status || "—",
            s.project.charter.currentPhase || "—",
            formatPct(s.metrics.overallProgressPct),
            `${s.health.score} (${s.health.rag})`,
            formatMoney(s.metrics.budgetPlanned),
            formatPct(s.metrics.budgetVariancePct),
            s.metrics.daysDelayed,
          ]),
        },
        {
          title: "Recommendations",
          headers: ["Severity", "Category", "Recommendation"],
          rows: generateRecommendations(snapshots).map((r) => [
            r.severity.toUpperCase(),
            r.category,
            r.message,
          ]),
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
        headers: ["Project", "Code", "Status", "Phase", "Planned Start", "Planned End", "Forecast End", "Elapsed %", "Progress %", "Days Remaining", "Days Delayed", "Health"],
        rows: projectRows(snapshots, (s) => [
          s.project.charter.projectName,
          s.project.charter.projectCode,
          s.project.charter.status || "—",
          s.project.charter.currentPhase || "—",
          formatDate(s.project.charter.plannedStartDate),
          formatDate(s.project.charter.plannedEndDate),
          formatDate(s.metrics.forecastEndDate),
          formatPct(s.metrics.timeElapsedPct),
          formatPct(s.metrics.overallProgressPct),
          s.metrics.daysRemaining ?? "—",
          s.metrics.daysDelayed,
          `${s.health.score} (${s.health.rag})`,
        ]),
      },
    ],
  },
  {
    key: "risks",
    title: "Risk Report",
    description: "Consolidated risk register across the portfolio.",
    build: (snapshots) => [
      {
        title: "Risks",
        headers: ["Project", "Risk ID", "Description", "Probability", "Impact", "Mitigation", "Owner", "Status"],
        rows: snapshots.flatMap((s) =>
          s.project.risks.map((r) => [
            s.project.charter.projectName,
            r.riskId,
            r.description,
            r.probability,
            r.impact,
            r.mitigation,
            r.owner,
            r.status,
          ]),
        ),
      },
    ],
  },
  {
    key: "issues",
    title: "Issue Report",
    description: "Consolidated issue log across the portfolio.",
    build: (snapshots) => [
      {
        title: "Issues",
        headers: ["Project", "Issue ID", "Description", "Severity", "Owner", "Raised", "Target", "Status"],
        rows: snapshots.flatMap((s) =>
          s.project.issues.map((i) => [
            s.project.charter.projectName,
            i.issueId,
            i.description,
            i.severity,
            i.owner,
            formatDate(i.raisedDate),
            formatDate(i.targetDate),
            i.status,
          ]),
        ),
      },
    ],
  },
  {
    key: "budget",
    title: "Budget Report",
    description: "Planned vs actual vs forecast, by project and category.",
    build: (snapshots) => [
      {
        title: "Budget by Project",
        headers: ["Project", "Planned", "Actual", "Forecast", "Variance", "Variance %", "Consumed %"],
        rows: projectRows(snapshots, (s) => [
          s.project.charter.projectName,
          formatMoney(s.metrics.budgetPlanned),
          formatMoney(s.metrics.budgetActual),
          formatMoney(s.metrics.budgetForecast),
          formatMoney(s.metrics.budgetVariance),
          formatPct(s.metrics.budgetVariancePct),
          formatPct(s.metrics.budgetConsumedPct),
        ]),
      },
      {
        title: "Budget by Category",
        headers: ["Project", "Category", "Planned", "Actual", "Forecast", "Variance"],
        rows: snapshots.flatMap((s) =>
          s.project.budget.map((b) => [
            s.project.charter.projectName,
            b.category,
            formatMoney(b.planned),
            formatMoney(b.actual),
            formatMoney(b.forecast),
            formatMoney(b.variance),
          ]),
        ),
      },
    ],
  },
  {
    key: "resources",
    title: "Resource Report",
    description: "Utilization, capacity and cost variance per resource.",
    build: (snapshots) => [
      {
        title: "Resources by Project",
        headers: ["Project", "Employee", "Role", "Allocation %", "Available", "Planned", "Actual", "Remaining", "Utilization %", "Cost Variance", "Over-allocated"],
        rows: snapshots.flatMap((s) =>
          s.metrics.resourceInsights.map((r) => [
            s.project.charter.projectName,
            r.employee,
            r.role,
            num(r.allocationPct),
            num(r.availableHours),
            num(r.plannedHours),
            num(r.actualHours),
            num(r.hoursRemaining),
            r.utilizationPct == null ? "—" : formatPct(r.utilizationPct),
            formatMoney(r.costVariance),
            r.overAllocated ? "YES" : "",
          ]),
        ),
      },
      {
        title: "Cross-project Capacity",
        headers: ["Employee", "Department", "Total Allocation %", "Projects", "Over-allocated"],
        rows: computeCapacity(snapshots).map((c) => [
          c.employee,
          c.department,
          Math.round(c.totalAllocationPct),
          c.projects.map((p) => p.projectName).join(", "),
          c.overAllocated ? "YES" : "",
        ]),
      },
    ],
  },
  {
    key: "milestones",
    title: "Milestone Report",
    description: "All milestones with status and dates.",
    build: (snapshots) => [
      {
        title: "Milestones",
        headers: ["Project", "Milestone", "Planned", "Actual", "Owner", "Progress %", "Status"],
        rows: snapshots.flatMap((s) =>
          s.project.milestones.map((m) => [
            s.project.charter.projectName,
            m.milestone,
            formatDate(m.plannedDate),
            formatDate(m.actualDate),
            m.owner,
            num(m.progressPct),
            m.status,
          ]),
        ),
      },
    ],
  },
  {
    key: "tasks",
    title: "Task Report",
    description: "Product backlog across all projects.",
    build: (snapshots) => [
      {
        title: "Tasks",
        headers: ["Project", "Task ID", "Title", "Epic", "Priority", "Points", "Est. Hrs", "Rem. Hrs", "Sprint", "Assignee", "Status", "Due"],
        rows: snapshots.flatMap((s) =>
          s.project.backlog.map((t) => [
            s.project.charter.projectName,
            t.taskId,
            t.taskTitle,
            t.epic,
            t.priority,
            t.storyPoints ?? "—",
            t.estimatedHours ?? "—",
            t.remainingHours ?? "—",
            t.sprint,
            t.assignee,
            t.status,
            formatDate(t.dueDate),
          ]),
        ),
      },
    ],
  },
  {
    key: "outputs",
    title: "Expected Outputs Report",
    description: "Deliverable tracking and customer approval status.",
    build: (snapshots) => [
      {
        title: "Expected Outputs",
        headers: ["Project", "Output ID", "Deliverable", "Owner", "Planned", "Actual", "Completion %", "Status", "Approval"],
        rows: snapshots.flatMap((s) =>
          s.project.outputs.map((o) => [
            s.project.charter.projectName,
            o.outputId,
            o.deliverable,
            o.owner,
            formatDate(o.plannedDeliveryDate),
            formatDate(o.actualDeliveryDate),
            num(o.completionPct),
            o.status,
            o.customerApproval,
          ]),
        ),
      },
    ],
  },
  {
    key: "governance",
    title: "Governance Report",
    description: "Phase-gate compliance per project against the standard framework.",
    build: (snapshots) => [
      {
        title: "Governance Scores",
        headers: ["Project", "Current Phase", "Governance Score", "Failed Checks"],
        rows: projectRows(snapshots, (s) => [
          s.project.charter.projectName,
          s.project.charter.currentPhase || "—",
          s.governance.score,
          s.governance.failedChecks.join("; ") || "None",
        ]),
      },
      {
        title: "Check Detail",
        headers: ["Project", "Phase", "Check", "Result"],
        rows: snapshots.flatMap((s) =>
          s.governance.phases
            .filter((p) => p.applicable)
            .flatMap((p) =>
              p.checks.map((c) => [
                s.project.charter.projectName,
                p.phase,
                c.label,
                c.passed ? "PASS" : "FAIL",
              ]),
            ),
        ),
      },
    ],
  },
];
